<?php

namespace MicroWeb\TiptapEditor\Support;

use InvalidArgumentException;

/** Lexical, portable disk-relative paths. Never normalize untrusted input. */
final class MediaPath
{
    public static function isCanonical(string $path): bool
    {
        if ($path === '' || strlen($path) > 1024) {
            return false;
        }

        foreach (explode('/', $path) as $segment) {
            if (strlen($segment) > 255
                || preg_match('/\A[A-Za-z0-9_-][A-Za-z0-9._-]*\z/D', $segment) !== 1
                || str_ends_with($segment, '.')
                || preg_match('/\A(?:CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(?:\.|\z)/i', $segment) === 1) {
                return false;
            }
        }

        return true;
    }

    public static function isChild(string $path, string $directory): bool
    {
        return self::isCanonical($path)
            && self::isCanonical($directory)
            && str_starts_with($path, $directory.'/');
    }

    public static function requireDirectory(mixed $directory): string
    {
        if (! is_string($directory) || ! self::isCanonical($directory)) {
            throw new InvalidArgumentException('Invalid editor media directory. Use a canonical disk-relative path.');
        }

        return $directory;
    }

    public static function requireDisjoint(string $first, string $second): void
    {
        // Also reject case aliases on case-insensitive filesystems.
        $first = strtolower(self::requireDirectory($first));
        $second = strtolower(self::requireDirectory($second));
        if ($first === $second || self::isChild($first, $second) || self::isChild($second, $first)) {
            throw new InvalidArgumentException('Editor temporary and permanent directories must not overlap.');
        }
    }

    /** @return array{temporary: string, permanent: string} */
    public static function directories(?string $destination = null): array
    {
        $temporary = self::requireDirectory(config('tiptap-editor.image_upload.temporary_directory', 'editor/tmp'));
        $defaultPermanent = self::requireDirectory(config('tiptap-editor.image_upload.permanent_directory', 'editor/images'));
        self::requireDisjoint($temporary, $defaultPermanent);

        // A destination is trusted host configuration/code, never editor input.
        $permanent = $destination === null ? $defaultPermanent : self::requireDirectory($destination);
        self::requireDisjoint($temporary, $permanent);

        return ['temporary' => $temporary, 'permanent' => $permanent];
    }
}
