<?php

namespace MicroWeb\TiptapEditor\Tests\Unit;

use LogicException;
use MicroWeb\TiptapEditor\Support\ImageUploadInspector;
use MicroWeb\TiptapEditor\Support\InvalidUploadedImage;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class ImageUploadInspectorTest extends TestCase
{
    public static function images(): array
    {
        return [
            'PNG' => ['iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAAFElEQVR4nGPUSNnCwMDAxMDAgKAAF4gBRrRYoVYAAAAASUVORK5CYII=', 'image/png', 'png'],
            'JPEG' => ['/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAADAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDmqKKK+sPnj//Z', 'image/jpeg', 'jpg'],
            'GIF' => ['R0lGODdhAgADAIEAAChktAAAAAAAAAAAACwAAAAAAgADAAAIBgABCBwYEAA7', 'image/gif', 'gif'],
            'WebP' => ['UklGRjoAAABXRUJQVlA4IC4AAADwAQCdASoCAAMAAUAmJaACdLoB+AAEgwAA/vAb3/89M15g/yc/+Uq8Fjc3wAAA', 'image/webp', 'webp'],
        ];
    }

    private function inspect(string $bytes, array $settings = []): array
    {
        $path = tempnam(sys_get_temp_dir(), 'mwimg');
        try {
            file_put_contents($path, $bytes);
            return ImageUploadInspector::inspectFile($path, $settings);
        } finally {
            unlink($path);
        }
    }

    #[DataProvider('images')]
    public function test_real_images_are_detected(string $encoded, string $mime, string $extension): void
    {
        $bytes = base64_decode($encoded, true);
        self::assertSame(['mime' => $mime, 'extension' => $extension, 'width' => 2, 'height' => 3, 'bytes' => strlen($bytes)], $this->inspect($bytes));
    }

    #[DataProvider('images')]
    public function test_truncated_images_are_rejected(string $encoded, string $mime, string $extension): void
    {
        $this->expectException(InvalidUploadedImage::class);
        $this->inspect(substr(base64_decode($encoded, true), 0, -3));
    }

    public function test_png_crc_corruption_is_rejected(): void
    {
        $bytes = base64_decode(self::images()['PNG'][0], true);
        $bytes[-1] = chr(ord($bytes[-1]) ^ 1);
        $this->expectException(InvalidUploadedImage::class);
        $this->inspect($bytes);
    }

    public function test_png_trailing_payload_is_rejected(): void
    {
        $this->expectException(InvalidUploadedImage::class);
        $this->inspect(base64_decode(self::images()['PNG'][0], true).'trailing bytes');
    }

    public function test_actual_bytes_are_bounded(): void
    {
        $this->expectException(InvalidUploadedImage::class);
        $this->inspect(str_repeat('x', 1025), ['max_size' => 1]);
    }

    public function test_exact_dimension_and_pixel_limits_are_accepted(): void
    {
        $info = $this->inspect(base64_decode(self::images()['PNG'][0], true), ['max_width' => 2, 'max_height' => 3, 'max_pixels' => 6]);
        self::assertSame(2, $info['width']);
    }

    public static function restrictions(): array
    {
        return [['max_width' => 1], ['max_height' => 2], ['max_pixels' => 5], ['allowed_mimes' => ['image/jpeg']]];
    }

    // Each provider entry wraps the settings array as one argument.
    public static function restrictedSettings(): array
    {
        return array_map(static fn (array $settings): array => [$settings], self::restrictions());
    }

    #[DataProvider('restrictedSettings')]
    public function test_configured_restrictions_are_enforced(array $settings): void
    {
        $this->expectException(InvalidUploadedImage::class);
        $this->inspect(base64_decode(self::images()['PNG'][0], true), $settings);
    }

    public static function invalidSettings(): array
    {
        return [[['max_size' => 0]], [['max_size' => 20481]], [['max_pixels' => -1]], [['max_width' => '8192']], [['allowed_mimes' => []]], [['allowed_mimes' => ['image/svg+xml']]], [['max_height' => null]]];
    }

    #[DataProvider('invalidSettings')]
    public function test_invalid_configuration_fails_closed(array $settings): void
    {
        $this->expectException(LogicException::class);
        ImageUploadInspector::settings($settings);
    }
}
