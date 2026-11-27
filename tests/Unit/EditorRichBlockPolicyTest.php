<?php

namespace MicroWeb\TiptapEditor\Tests\Unit;

use MicroWeb\TiptapEditor\Support\EditorHtmlPolicy;
use PHPUnit\Framework\TestCase;

final class EditorRichBlockPolicyTest extends TestCase
{
    public function test_video_embeds_require_canonical_provider_paths(): void
    {
        foreach (['https://www.youtube.com/embed/dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'https://player.vimeo.com/video/123456789'] as $url) {
            self::assertSame($url, EditorHtmlPolicy::videoUrl($url));
        }
        foreach (['https://youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/embed/invalid', 'http://www.youtube.com/embed/dQw4w9WgXcQ', 'https://www.youtube.com:443/embed/dQw4w9WgXcQ', 'https://user@www.youtube.com/embed/dQw4w9WgXcQ', 'https://youtube.com.evil.invalid/embed/dQw4w9WgXcQ', 'https://player.vimeo.com/video/123/extra'] as $url) {
            self::assertNull(EditorHtmlPolicy::videoUrl($url));
        }
    }

    public function test_news_metadata_urls_and_table_dimensions_are_bounded(): void
    {
        self::assertSame('/news/fixture', EditorHtmlPolicy::attribute('article', 'data-url', '/news/fixture'));
        self::assertSame('/storage/example.png', EditorHtmlPolicy::attribute('article', 'data-thumbnail', '/storage/example.png'));
        self::assertNull(EditorHtmlPolicy::attribute('article', 'data-url', 'javascript:alert(1)'));
        self::assertNull(EditorHtmlPolicy::attribute('article', 'data-thumbnail', '//evil.invalid/a.png'));
        self::assertSame('2', EditorHtmlPolicy::attribute('td', 'colspan', '2'));
        self::assertNull(EditorHtmlPolicy::attribute('td', 'colspan', '0'));
        self::assertNull(EditorHtmlPolicy::attribute('th', 'rowspan', '1001'));
        self::assertNull(EditorHtmlPolicy::attribute('td', 'colwidth', 'bad'));
    }
}
