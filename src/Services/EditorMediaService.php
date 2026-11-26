<?php

namespace MicroWeb\TiptapEditor\Services;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use InvalidArgumentException;
use MicroWeb\TiptapEditor\Exceptions\MediaStorageBusyException;
use MicroWeb\TiptapEditor\Support\ManagedMediaHtml;
use MicroWeb\TiptapEditor\Support\MediaPath;
use MicroWeb\TiptapEditor\Support\MediaMoveBatch;
use MicroWeb\TiptapEditor\Support\MediaStorageLock;
use MicroWeb\TiptapEditor\Support\TemporaryMediaOwner;
use RuntimeException;
use Throwable;

class EditorMediaService
{
    public function finalize(
        string $html,
        ?string $directory = null,
        ?string $guard = null
    ): string {
        $diskName = (string) config(
            'tiptap-editor.image_upload.disk',
            'public'
        );

        if ($html === '') {
            return $html;
        }

        $directories = MediaPath::directories($directory);
        $temporaryDirectory = $directories['temporary'];
        $permanentDirectory = $directories['permanent'];

        if (stripos($html, 'data-mw-path') === false) {
            return $html;
        }

        $fragment = ManagedMediaHtml::parse($html);
        $references = array_filter(
            $fragment->references(),
            static fn (string|int $path): bool => MediaPath::isChild(strtolower((string) $path), strtolower($temporaryDirectory)),
            ARRAY_FILTER_USE_KEY
        );
        if ($references === []) {
            return $html;
        }

        $ownerDirectory = TemporaryMediaOwner::directory($guard);
        foreach (array_keys($references) as $path) {
            if (! TemporaryMediaOwner::owns($path, $ownerDirectory)) {
                throw new AuthorizationException('Temporary editor media is not owned by the authenticated user.');
            }
        }

        // Validate all reference shapes before opening storage.
        $images = [];
        foreach ($references as $path => $nodes) {
            foreach ($nodes as $node) {
                $images[$path][] = ManagedMediaHtml::imageFor($node);
            }
        }

        return MediaStorageLock::run($diskName, function () use ($diskName, $references, $images, $permanentDirectory, $fragment): string {
            $disk = Storage::disk($diskName);
            if (! $disk instanceof FilesystemAdapter) {
                throw new RuntimeException('Editor media finalization requires a Laravel filesystem adapter.');
            }
            $plan = [];
            $destinations = [];
            foreach ($references as $path => $nodes) {
                $oldUrl = $this->publicUrl($disk, $diskName, $path);
                foreach ($images[$path] as $image) {
                    if ($image->getAttribute('src') !== $oldUrl) {
                        throw new InvalidArgumentException('Managed image source does not match its temporary media path.');
                    }
                }

                if (! $disk->fileExists($path)) {
                    throw new RuntimeException('Referenced temporary editor media is missing. Re-upload the image.');
                }
                $newPath = $this->permanentPath($path, $permanentDirectory);
                if (isset($destinations[$newPath]) || $disk->exists($newPath)) {
                    throw new RuntimeException('Permanent editor media destination already exists.');
                }
                $destinations[$newPath] = true;
                $newUrl = $this->publicUrl($disk, $diskName, $newPath);
                $plan[$path] = $newPath;

                // Only these actual path nodes and their associated images change.
                foreach ($nodes as $index => $node) {
                    $node->setAttribute('data-mw-path', $newPath);
                    $images[$path][$index]->setAttribute('src', $newUrl);
                }
            }

            // Serialize the entire batch before changing storage. Compensation
            // applies to this batch only, not to a later host database transaction.
            $finalHtml = $fragment->html();
            MediaMoveBatch::execute($disk, $diskName, $plan);

            return $finalHtml;
        });
    }

    public function cleanupTemporaryMedia(
        ?int $olderThanHours = null
    ): int {
        $diskName = (string) config(
            'tiptap-editor.image_upload.disk',
            'public'
        );

        $temporaryDirectory = MediaPath::directories()['temporary'];

        $hours = $olderThanHours ?? config('tiptap-editor.image_upload.temporary_lifetime', 24);
        if (! is_int($hours) || $hours < 1 || $hours > 87600) {
            throw new InvalidArgumentException('Editor temporary media lifetime must be an integer from 1 to 87600 hours.');
        }

        $disk = Storage::disk($diskName);
        if (! $disk instanceof FilesystemAdapter) {
            throw new RuntimeException('Editor media cleanup requires a Laravel filesystem adapter.');
        }

        $threshold = now()->subHours($hours)->getTimestamp();
        $deleted = 0;
        $seen = [];

        foreach ($disk->allFiles($temporaryDirectory) as $path) {
            if (! is_string($path) || ! self::isCleanupCandidate($path, $temporaryDirectory)) {
                continue;
            }
            if (isset($seen[$path])) {
                continue;
            }
            $seen[$path] = true;

            try {
                $removed = MediaStorageLock::run($diskName, static function () use ($disk, $path, $threshold): bool {
                    // Listing is only a hint. Recheck type and age under the
                    // same lock used for uploading, finalization and rollback.
                    try {
                        if (! $disk->fileExists($path) || $disk->lastModified($path) > $threshold) {
                            return false;
                        }
                        if (! $disk->delete($path)) {
                            report(new RuntimeException('Editor temporary media deletion was not acknowledged.'));
                            return false;
                        }
                        if ($disk->exists($path)) {
                            report(new RuntimeException('Editor temporary media deletion could not be verified.'));
                            return false;
                        }
                        return true;
                    } catch (Throwable $failure) {
                        report($failure);
                        return false;
                    }
                });
                if ($removed) {
                    $deleted++;
                }
            } catch (MediaStorageBusyException) {
                // Never bypass a busy lock. A later cleanup can retry this file.
                continue;
            }
        }

        return $deleted;
    }

    private static function isCleanupCandidate(string $path, string $temporaryDirectory): bool
    {
        if (! MediaPath::isChild($path, $temporaryDirectory)) {
            return false;
        }

        // Keep migration-era flat temporary files eligible for expiry, plus
        // direct owner-scoped files. Never delete unknown nested content.
        $relative = substr($path, strlen($temporaryDirectory) + 1);
        return ! str_contains($relative, '/')
            || preg_match('~\Aowner-[a-f0-9]{64}/[^/]+\z~D', $relative) === 1;
    }

    public function extractManagedPaths(string $html): array
    {
        if ($html === '' || stripos($html, 'data-mw-path') === false) {
            return [];
        }

        // Numeric-only keys are converted to integers by PHP arrays. Keep the
        // public API a list of strings even for canonical non-media references.
        return array_map('strval', array_keys(ManagedMediaHtml::parse($html)->references()));
    }

    private function permanentPath(string $oldPath, string $permanentDirectory): string
    {
        $extension = pathinfo($oldPath, PATHINFO_EXTENSION);
        $filename = (string) Str::uuid();
        if ($extension !== '') {
            $filename .= '.'.strtolower($extension);
        }
        $path = $permanentDirectory.'/'.$filename;
        if (! MediaPath::isChild($path, $permanentDirectory)) {
            throw new InvalidArgumentException('Invalid generated permanent media path.');
        }

        return $path;
    }

    private function publicUrl(FilesystemAdapter $disk, string $diskName, string $path): string
    {
        if ($diskName === 'public') {
            return '/storage/'.$path;
        }
        $url = $disk->url($path);
        if ($url === '') {
            throw new RuntimeException('Unable to resolve editor media URL.');
        }

        return $url;
    }
}
