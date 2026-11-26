<?php

namespace MicroWeb\TiptapEditor\Support;

use Illuminate\Filesystem\FilesystemAdapter;
use MicroWeb\TiptapEditor\Exceptions\MediaFinalizationException;
use RuntimeException;
use Throwable;

/** @internal Executes only the trusted, validated plan produced by EditorMediaService. */
final class MediaMoveBatch
{
    /** @param array<string, string> $plan Source path => unique destination path. */
    public static function execute(FilesystemAdapter $disk, string $diskName, array $plan): void
    {
        $completed = [];
        $attempted = null;

        try {
            foreach ($plan as $source => $destination) {
                // Recheck immediately before a move; this is not an atomic lock.
                if (! $disk->fileExists($source) || $disk->exists($destination)) {
                    throw new RuntimeException('Editor media source or destination changed before the move.');
                }

                $attempted = [$source, $destination];
                if (! $disk->move($source, $destination)) {
                    throw new RuntimeException('Editor media move returned failure.');
                }

                // Only acknowledged moves are eligible for automatic reversal.
                $completed[] = $attempted;
                $attempted = null;
                if ($disk->exists($source) || ! $disk->fileExists($destination)) {
                    throw new RuntimeException('Editor media move postcondition failed.');
                }
            }
        } catch (Throwable $failure) {
            $recovery = [];

            // A failed/throwing move can have changed storage. Never delete or
            // assume ownership of its destination when acknowledgement is absent.
            if ($attempted !== null) {
                [$source, $destination] = $attempted;
                if (! self::isRestored($disk, $source, $destination)) {
                    $recovery[] = self::entry($source, $destination, 'unacknowledged_move');
                }
            }

            foreach (array_reverse($completed) as [$source, $destination]) {
                if (! self::restore($disk, $source, $destination)) {
                    $recovery[] = self::entry($source, $destination, 'rollback_unconfirmed');
                }
            }

            throw new MediaFinalizationException($diskName, $recovery, $failure);
        }
    }

    private static function restore(FilesystemAdapter $disk, string $source, string $destination): bool
    {
        try {
            // Refuse to overwrite an occupied original path, including a directory.
            // If the original exists and destination is absent, no write is needed.
            if ($disk->exists($source)) {
                return self::isRestored($disk, $source, $destination);
            }
            if (! $disk->fileExists($destination)) {
                return false;
            }
            $disk->move($destination, $source);
        } catch (Throwable) {
            // A reverse move can throw after succeeding. Verify the resulting state.
        }

        return self::isRestored($disk, $source, $destination);
    }

    private static function isRestored(FilesystemAdapter $disk, string $source, string $destination): bool
    {
        try {
            return $disk->fileExists($source) && ! $disk->exists($destination);
        } catch (Throwable) {
            return false;
        }
    }

    /** @return array{source: string, destination: string, reason: string} */
    private static function entry(string $source, string $destination, string $reason): array
    {
        return ['source' => $source, 'destination' => $destination, 'reason' => $reason];
    }
}
