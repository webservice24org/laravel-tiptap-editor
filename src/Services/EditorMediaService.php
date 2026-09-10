<?php

namespace MicroWeb\TiptapEditor\Services;

use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class EditorMediaService
{
    public function finalize(
        string $html,
        ?string $directory = null
    ): string {
        $diskName = (string) config(
            'tiptap-editor.image_upload.disk',
            'public'
        );

        $temporaryDirectory = trim(
            (string) config(
                'tiptap-editor.image_upload.temporary_directory',
                'editor/tmp'
            ),
            '/'
        );

        $permanentDirectory = trim(
            $directory
                ?: (string) config(
                    'tiptap-editor.image_upload.permanent_directory',
                    'editor/images'
                ),
            '/'
        );

        if (
            $html === ''
            ||
            $temporaryDirectory === ''
            ||
            $permanentDirectory === ''
        ) {
            return $html;
        }

        $disk = Storage::disk(
            $diskName
        );

        $paths = $this->extractManagedPaths(
            $html
        );

        foreach ($paths as $path) {
            $path = ltrim(
                $path,
                '/'
            );

            if (
                ! $this->isTemporaryPath(
                    $path,
                    $temporaryDirectory
                )
                ||
                ! $disk->exists(
                    $path
                )
            ) {
                continue;
            }

            $newPath = $this->moveToPermanentDirectory(
                disk: $disk,
                oldPath: $path,
                permanentDirectory: $permanentDirectory
            );

            if (! $newPath) {
                continue;
            }

            $oldUrl = $this->publicUrl(
                $diskName,
                $path
            );

            $newUrl = $this->publicUrl(
                $diskName,
                $newPath
            );

            $html = $this->rewriteManagedMedia(
                html: $html,
                oldPath: $path,
                newPath: $newPath,
                oldUrl: $oldUrl,
                newUrl: $newUrl
            );
        }

        return $html;
    }

    public function cleanupTemporaryMedia(
        ?int $olderThanHours = null
    ): int {
        $diskName = (string) config(
            'tiptap-editor.image_upload.disk',
            'public'
        );

        $temporaryDirectory = trim(
            (string) config(
                'tiptap-editor.image_upload.temporary_directory',
                'editor/tmp'
            ),
            '/'
        );

        $hours = max(
            1,
            $olderThanHours
                ?? (int) config(
                    'tiptap-editor.image_upload.temporary_lifetime',
                    24
                )
        );

        if ($temporaryDirectory === '') {
            return 0;
        }

        $disk = Storage::disk(
            $diskName
        );

        $threshold = now()
            ->subHours(
                $hours
            )
            ->getTimestamp();

        $deleted = 0;

        foreach (
            $disk->allFiles(
                $temporaryDirectory
            )
            as $path
        ) {
            try {
                $lastModified = $disk
                    ->lastModified(
                        $path
                    );
            } catch (\Throwable) {
                continue;
            }

            if (
                $lastModified >
                $threshold
            ) {
                continue;
            }

            if (
                $disk->delete(
                    $path
                )
            ) {
                $deleted++;
            }
        }

        return $deleted;
    }

    public function extractManagedPaths(
        string $html
    ): array {
        if ($html === '') {
            return [];
        }

        preg_match_all(
            '/\bdata-mw-path=(["\'])(.*?)\1/i',
            $html,
            $matches
        );

        $paths = array_map(
            static fn (
                string $path
            ): string =>
                html_entity_decode(
                    $path,
                    ENT_QUOTES
                    | ENT_HTML5,
                    'UTF-8'
                ),
            $matches[2] ?? []
        );

        return array_values(
            array_unique(
                array_filter(
                    $paths,
                    static fn (
                        string $path
                    ): bool =>
                        trim(
                            $path
                        ) !== ''
                )
            )
        );
    }

    private function moveToPermanentDirectory(
        Filesystem $disk,
        string $oldPath,
        string $permanentDirectory
    ): ?string {
        $extension = pathinfo(
            $oldPath,
            PATHINFO_EXTENSION
        );

        $filename = (string) Str::uuid();

        if ($extension !== '') {
            $filename .= '.'
                .strtolower(
                    $extension
                );
        }

        $newPath =
            $permanentDirectory
            .'/'
            .$filename;

        $moved = $disk->move(
            $oldPath,
            $newPath
        );

        return $moved
            ? $newPath
            : null;
    }

    private function rewriteManagedMedia(
        string $html,
        string $oldPath,
        string $newPath,
        string $oldUrl,
        string $newUrl
    ): string {
        $encodedOldPath = htmlspecialchars(
            $oldPath,
            ENT_QUOTES
            | ENT_HTML5,
            'UTF-8'
        );

        $encodedNewPath = htmlspecialchars(
            $newPath,
            ENT_QUOTES
            | ENT_HTML5,
            'UTF-8'
        );

        $html = str_replace(
            [
                'data-mw-path="'.$oldPath.'"',
                "data-mw-path='".$oldPath."'",
                'data-mw-path="'.$encodedOldPath.'"',
                "data-mw-path='".$encodedOldPath."'",
            ],
            [
                'data-mw-path="'.$newPath.'"',
                "data-mw-path='".$newPath."'",
                'data-mw-path="'.$encodedNewPath.'"',
                "data-mw-path='".$encodedNewPath."'",
            ],
            $html
        );

        if ($oldUrl !== '') {
            $html = str_replace(
                [
                    'src="'.$oldUrl.'"',
                    "src='".$oldUrl."'",
                ],
                [
                    'src="'.$newUrl.'"',
                    "src='".$newUrl."'",
                ],
                $html
            );
        }

        return $html;
    }

    private function isTemporaryPath(
        string $path,
        string $temporaryDirectory
    ): bool {
        return $path ===
            $temporaryDirectory
            ||
            str_starts_with(
                $path,
                $temporaryDirectory.'/'
            );
    }

    private function publicUrl(
        string $diskName,
        string $path
    ): string {
        if ($diskName === 'public') {
            return '/storage/'
                .ltrim(
                    $path,
                    '/'
                );
        }

        try {
            $disk = Storage::disk(
                $diskName
            );

            if (
                ! $disk instanceof
                FilesystemAdapter
            ) {
                return '';
            }

            return $disk->url(
                $path
            );
        } catch (\Throwable) {
            return '';
        }
    }
}
