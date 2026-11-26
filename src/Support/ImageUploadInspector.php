<?php

namespace MicroWeb\TiptapEditor\Support;

use LogicException;

/** Bounded byte and image-envelope inspection; not a full pixel decoder. */
final class ImageUploadInspector
{
    private const TYPES = [
        'image/jpeg' => [IMAGETYPE_JPEG, 'jpg'],
        'image/png' => [IMAGETYPE_PNG, 'png'],
        'image/webp' => [IMAGETYPE_WEBP, 'webp'],
        'image/gif' => [IMAGETYPE_GIF, 'gif'],
    ];

    public static function settings(mixed $settings = []): array
    {
        if (! is_array($settings)) {
            throw new LogicException('Invalid editor image upload configuration.');
        }
        $limits = [];
        foreach ([
            'max_size' => [5120, 20480],
            'max_width' => [8192, 16384],
            'max_height' => [8192, 16384],
            'max_pixels' => [40000000, 100000000],
        ] as $key => [$default, $ceiling]) {
            $value = array_key_exists($key, $settings) ? $settings[$key] : $default;
            if (! is_int($value) || $value < 1 || $value > $ceiling) {
                throw new LogicException('Invalid editor image upload limit: '.$key);
            }
            $limits[$key] = $value;
        }
        $mimes = array_key_exists('allowed_mimes', $settings) ? $settings['allowed_mimes'] : array_keys(self::TYPES);
        if (! is_array($mimes) || $mimes === []) {
            throw new LogicException('Invalid editor image MIME configuration.');
        }
        foreach ($mimes as $mime) {
            if (! is_string($mime) || ! isset(self::TYPES[$mime])) {
                throw new LogicException('Unsupported editor image MIME configuration.');
            }
        }
        $limits['allowed_mimes'] = array_values(array_unique($mimes));
        return $limits;
    }

    /** Only pass the trusted local PHP upload temporary filename, never request text. */
    public static function inspectFile(string $path, mixed $settings = []): array
    {
        $settings = self::settings($settings);
        $maxBytes = $settings['max_size'] * 1024;
        if (! is_file($path) || ! is_readable($path)) {
            throw new InvalidUploadedImage('The uploaded image is unavailable.');
        }
        $bytes = @file_get_contents($path, false, null, 0, $maxBytes + 1);
        if (! is_string($bytes) || $bytes === '' || strlen($bytes) > $maxBytes) {
            throw new InvalidUploadedImage('The uploaded image is empty or exceeds the allowed file size.');
        }
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes);
        if (! is_string($mime) || ! in_array($mime, $settings['allowed_mimes'], true)) {
            throw new InvalidUploadedImage('The uploaded image format is not allowed.');
        }
        $info = @getimagesizefromstring($bytes);
        [$type, $extension] = self::TYPES[$mime];
        if (! is_array($info) || ($info[2] ?? null) !== $type || ($info['mime'] ?? null) !== $mime) {
            throw new InvalidUploadedImage('The uploaded image type is inconsistent or invalid.');
        }
        [$width, $height] = $info;
        if (! is_int($width) || ! is_int($height) || $width < 1 || $height < 1
            || $width > $settings['max_width'] || $height > $settings['max_height']
            || $width > intdiv($settings['max_pixels'], $height)) {
            throw new InvalidUploadedImage('The uploaded image exceeds the allowed dimensions or pixel count.');
        }
        $valid = match ($mime) {
            'image/png' => self::png($bytes),
            'image/jpeg' => self::jpeg($bytes),
            'image/gif' => self::gif($bytes, $width, $height),
            'image/webp' => self::webp($bytes),
        };
        if (! $valid) {
            throw new InvalidUploadedImage('The uploaded image has an invalid or incomplete file structure.');
        }
        return ['mime' => $mime, 'extension' => $extension, 'width' => $width, 'height' => $height, 'bytes' => strlen($bytes)];
    }

    private static function png(string $bytes): bool
    {
        if (! str_starts_with($bytes, "\x89PNG\r\n\x1a\n")) { return false; }
        $end = strlen($bytes);
        $offset = 8;
        $data = false;
        for ($count = 0; $count < 10000 && $offset <= $end - 12; $count++) {
            $length = unpack('N', substr($bytes, $offset, 4))[1];
            if ($length > $end - $offset - 12) { return false; }
            $tag = substr($bytes, $offset + 4, 4);
            if (! preg_match('/\A[A-Za-z]{4}\z/D', $tag)) { return false; }
            if ($count === 0 ? ($tag !== 'IHDR' || $length !== 13) : $tag === 'IHDR') { return false; }
            $crc = substr($bytes, $offset + 8 + $length, 4);
            if (! hash_equals($crc, hash('crc32b', substr($bytes, $offset + 4, $length + 4), true))) { return false; }
            $offset += $length + 12;
            if ($tag === 'IDAT' && $length > 0) { $data = true; }
            if ($tag === 'IEND') { return $length === 0 && $data && $offset === $end; }
        }
        return false;
    }

    /** Validate JPEG marker lengths before the first scan; require an end marker. */
    private static function jpeg(string $bytes): bool
    {
        $end = strlen($bytes);
        if (! str_starts_with($bytes, "\xff\xd8") || ! str_ends_with($bytes, "\xff\xd9")) { return false; }
        $offset = 2;
        for ($count = 0; $count < 10000 && $offset < $end - 2; $count++) {
            if ($bytes[$offset++] !== "\xff") { return false; }
            while ($offset < $end && $bytes[$offset] === "\xff") { $offset++; }
            if ($offset >= $end - 2) { return false; }
            $marker = ord($bytes[$offset++]);
            if ($marker === 0 || $marker === 0xd8 || $marker === 0xd9 || ($marker >= 0xd0 && $marker <= 0xd7)) { return false; }
            if ($offset > $end - 4) { return false; }
            $length = unpack('n', substr($bytes, $offset, 2))[1];
            if ($length < 2 || $length > $end - $offset - 2) { return false; }
            $offset += $length;
            if ($marker === 0xda) { return $length >= 6 && $offset < $end - 2; }
        }
        return false;
    }

    private static function gif(string $bytes, int $width, int $height): bool
    {
        $end = strlen($bytes);
        if ($end < 14 || ! in_array(substr($bytes, 0, 6), ['GIF87a', 'GIF89a'], true)) { return false; }
        $packed = ord($bytes[10]);
        $offset = 13 + (($packed & 128) ? 3 * (1 << (($packed & 7) + 1)) : 0);
        $frames = 0;
        $blocks = 0;
        while ($offset < $end && ++$blocks <= 100000) {
            $tag = ord($bytes[$offset++]);
            if ($tag === 0x3b) { return $frames > 0 && $offset === $end; }
            if ($tag === 0x21) {
                if ($offset >= $end) { return false; }
                $offset++; // extension label
            } elseif ($tag === 0x2c) {
                if ($offset > $end - 9) { return false; }
                $rect = unpack('vx/vy/vw/vh/Cpacked', substr($bytes, $offset, 9));
                if ($rect['w'] < 1 || $rect['h'] < 1 || $rect['x'] + $rect['w'] > $width || $rect['y'] + $rect['h'] > $height) { return false; }
                $offset += 9 + (($rect['packed'] & 128) ? 3 * (1 << (($rect['packed'] & 7) + 1)) : 0);
                if ($offset >= $end || ord($bytes[$offset]) < 2 || ord($bytes[$offset]) > 8) { return false; }
                $offset++; // LZW minimum code size
                if ($offset >= $end || $bytes[$offset] === "\0") { return false; }
                $frames++;
            } else { return false; }
            do {
                if ($offset >= $end || ++$blocks > 100000) { return false; }
                $length = ord($bytes[$offset++]);
                if ($length > $end - $offset) { return false; }
                $offset += $length;
            } while ($length !== 0);
        }
        return false;
    }

    private static function webp(string $bytes): bool
    {
        $end = strlen($bytes);
        if ($end < 20 || substr($bytes, 0, 4) !== 'RIFF' || substr($bytes, 8, 4) !== 'WEBP'
            || unpack('V', substr($bytes, 4, 4))[1] !== $end - 8) { return false; }
        $offset = 12;
        $data = false;
        for ($count = 0; $count < 10000 && $offset <= $end - 8; $count++) {
            $tag = substr($bytes, $offset, 4);
            $length = unpack('V', substr($bytes, $offset + 4, 4))[1];
            $offset += 8;
            if ($length > $end - $offset || ($length % 2 && $length === $end - $offset)) { return false; }
            if (($tag === 'VP8 ' && $length >= 10) || ($tag === 'VP8L' && $length >= 5) || ($tag === 'ANMF' && $length >= 24)) { $data = true; }
            $offset += $length;
            if ($length % 2) {
                if ($bytes[$offset] !== "\0") { return false; }
                $offset++;
            }
        }
        return $data && $offset === $end;
    }
}
