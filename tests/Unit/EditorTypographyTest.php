<?php

namespace MicroWeb\TiptapEditor\Tests\Unit;

use MicroWeb\TiptapEditor\Services\EditorHtmlSanitizer;
use MicroWeb\TiptapEditor\Support\EditorHtmlPolicy;
use PHPUnit\Framework\TestCase;

final class EditorTypographyTest extends TestCase
{
    public function test_safe_typography_is_preserved(): void
    {
        $html = '<p><span style="color: red; font-size: 20px; font-family: serif">Text</span></p>';
        $sanitizer = new EditorHtmlSanitizer();
        self::assertSame($html, $sanitizer->sanitize($html));
        self::assertSame($html, $sanitizer->sanitize($sanitizer->sanitize($html)));
    }

    public function test_typography_is_restricted_to_span_presets(): void
    {
        foreach (['12px', '16px', '20px', '24px'] as $size) {
            self::assertSame('font-size: '.$size, EditorHtmlPolicy::attribute('span', 'style', 'font-size: '.$size));
        }
        foreach (['serif', 'sans-serif', 'monospace'] as $family) {
            self::assertSame('font-family: '.$family, EditorHtmlPolicy::attribute('span', 'style', 'font-family: '.$family));
        }
        foreach (['font-size: 999px', 'font-size: calc(20px)', 'font-family: RemoteFont', 'font-family: url(https://example.com)', 'font-family: serif !important'] as $style) {
            self::assertNull(EditorHtmlPolicy::attribute('span', 'style', $style));
        }
        self::assertNull(EditorHtmlPolicy::attribute('p', 'style', 'font-size: 20px; font-family: serif'));
    }

    public function test_link_policy_and_blank_target_security(): void
    {
        foreach (['/article', '#section', 'https://example.com/'] as $href) {
            self::assertSame($href, EditorHtmlPolicy::attribute('a', 'href', $href));
        }
        foreach (['//example.com', 'mailto:a@example.com', 'https://user@example.com/', 'javascript:alert(1)'] as $href) {
            self::assertNull(EditorHtmlPolicy::attribute('a', 'href', $href));
        }
        $html = (new EditorHtmlSanitizer())->sanitize('<p><a href="https://example.com/" target="_blank" rel="opener">Link</a></p>');
        self::assertStringContainsString('noopener', $html);
        self::assertStringContainsString('noreferrer', $html);
        self::assertStringNotContainsString('rel="opener"', $html);
    }
}
