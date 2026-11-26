<?php

namespace MicroWeb\TiptapEditor\Tests\Unit;

use MicroWeb\TiptapEditor\Support\EditorHtmlPolicy as Policy;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class EditorHtmlPolicyTest extends TestCase
{
    public static function unsafeUrls(): array
    {
        return [
            ['javascript:alert(1)'], ['JaVaScRiPt:alert(1)'], ["java\tscript:alert(1)"],
            ['data:text/html,test'], ['vbscript:alert(1)'], ['//example.com/image.png'],
            ['/\\example.com/image.png'], ['https://user@example.com/'], ['https:example.com'],
            ['file:///tmp/test'], ["https://example.com/\nimage.png"], ['https://exa mple.com/'],
            ['https://example.com\\@other.example/'], ["https://example.com/\u{200B}x"],
        ];
    }

    #[DataProvider('unsafeUrls')]
    public function test_unsafe_urls_are_rejected(string $url): void
    {
        self::assertNull(Policy::url($url, fragment: true));
    }

    public static function safeUrls(): array
    {
        return [
            ['https://example.com/news?id=1&ref=2'], ['http://localhost:8000/storage/editor/image.png'],
            ['/storage/editor/image.png'], ['/news/example'], ['#section'],
        ];
    }

    #[DataProvider('safeUrls')]
    public function test_supported_urls_are_preserved(string $url): void
    {
        self::assertSame($url, Policy::url($url, fragment: true));
    }

    public function test_video_provider_and_embed_path_are_validated(): void
    {
        foreach (['https://www.youtube.com/embed/dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=20', 'https://player.vimeo.com/video/123456789?h=abc'] as $url) {
            self::assertSame($url, Policy::videoUrl($url));
        }
        foreach (['http://www.youtube.com/embed/dQw4w9WgXcQ', 'https://youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com.evil.example/embed/dQw4w9WgXcQ', 'https://www.youtube.com:8443/embed/dQw4w9WgXcQ', 'https://player.vimeo.com/video/../123456789', 'https://player.vimeo.com/video/foo', 'https://youtube.com/embed/%2fabc'] as $url) {
            self::assertNull(Policy::videoUrl($url));
        }
    }

    public function test_css_rejects_unapproved_properties_and_value_syntax(): void
    {
        $style = 'width: 50%; color: #123abc; position: fixed; width: var(--external); padding: 4px 8px; '
            .'background-color: u\\72l(https://example.com/x); --mw-table-border-color: url(https://example.com/x); '
            .'border-color: rgb(12, 34, 56); max-width: calc(100% - 2px); clear: both; color: red!important';
        self::assertSame('width: 50%; color: #123abc; padding: 4px 8px; border-color: rgb(12, 34, 56); clear: both', Policy::style($style));
    }

    public function test_class_and_attribute_rules_are_element_specific(): void
    {
        self::assertSame('mw-news-block mw-news-block-card', Policy::attribute('article', 'class', 'mw-news-block fixed mw-news-block-card fixed'));
        self::assertNull(Policy::attribute('div', 'href', '/safe'));
        self::assertNull(Policy::attribute('div', 'data-url', '/safe'));
        self::assertNull(Policy::attribute('img', 'data-mw-path', 'editor/tmp/../image.png'));
        self::assertSame('editor/tmp/image.png', Policy::attribute('img', 'data-mw-path', 'editor/tmp/image.png'));
        self::assertNull(Policy::attribute('table', 'data-border-color', 'url(https://example.com/x)'));
        self::assertNull(Policy::attribute('td', 'colspan', '999999'));
        self::assertSame('120,240', Policy::attribute('td', 'colwidth', '120,240'));
    }
}
