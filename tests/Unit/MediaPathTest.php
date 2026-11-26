<?php

namespace MicroWeb\TiptapEditor\Tests\Unit;

use InvalidArgumentException;
use MicroWeb\TiptapEditor\Support\MediaPath;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class MediaPathTest extends TestCase
{
    public static function validPaths(): array
    {
        return [
            ['editor/tmp/abc-123.png'], ['editor/images/products/42/description/a.jpg'],
            ['news/9'], ['a_b/c.D-1.webp'], ['editor/tmp/nested/image.png'],
        ];
    }

    public static function invalidPaths(): array
    {
        return array_map(static fn (string $path): array => [$path], [
            '', '/', '/editor/tmp/a.png', 'editor/tmp/', 'editor//tmp/a.png',
            'editor/tmp/../a.png', 'editor/tmp/./a.png', '../a.png',
            'editor/tmp/%2e%2e/a.png', 'editor/tmp/%252e%252e/a.png',
            'editor\\tmp\\a.png', 'C:/editor/tmp/a.png', 'https://example.org/a.png',
            '//server/share/a.png', "editor/tmp/a\0.png", "editor/tmp/a\n.png",
            'editor/tmp/a.png ', ' editor/tmp/a.png', 'editor/tmp/a.png.',
            'editor/tmp/CON.png', 'editor/tmp/NUL', 'editor/tmp/com1.jpg',
            'editor/tmp/LPT9.jpg', 'editor/tmp/a.png:stream', 'editor/tmp/.hidden',
            'editor/tmp/a?b.png', 'editor/tmp/a#b.png', 'editor/tmp/বাংলা.png',
            str_repeat('a', 256), str_repeat('a/', 512).'x',
        ]);
    }

    #[DataProvider('validPaths')]
    public function test_canonical_paths_are_accepted(string $path): void
    {
        self::assertTrue(MediaPath::isCanonical($path));
        self::assertSame($path, MediaPath::requireDirectory($path));
    }

    #[DataProvider('invalidPaths')]
    public function test_noncanonical_paths_are_rejected(string $path): void
    {
        self::assertFalse(MediaPath::isCanonical($path));
        self::assertFalse(MediaPath::isChild($path, 'editor/tmp'));
    }

    public function test_membership_requires_a_strict_child_and_exact_segment_boundary(): void
    {
        self::assertTrue(MediaPath::isChild('editor/tmp/nested/a.png', 'editor/tmp'));
        foreach (['editor/tmp', 'editor/tmp-other/a.png', 'editor/images/a.png', 'Editor/tmp/a.png'] as $path) {
            self::assertFalse(MediaPath::isChild($path, 'editor/tmp'));
        }
    }

    public static function overlaps(): array
    {
        return [ ['editor/tmp', 'editor/tmp'], ['editor/tmp', 'editor/tmp/nested'],
            ['editor/tmp', 'editor'], ['EDITOR/TMP', 'editor/tmp/nested'] ];
    }

    #[DataProvider('overlaps')]
    public function test_overlapping_directories_are_rejected(string $a, string $b): void
    {
        $this->expectException(InvalidArgumentException::class);
        MediaPath::requireDisjoint($a, $b);
    }

    public function test_separate_directories_can_share_a_parent(): void
    {
        MediaPath::requireDisjoint('editor/tmp', 'editor/images');
        self::assertTrue(MediaPath::isChild('editor/images/a.png', 'editor/images'));
    }
}
