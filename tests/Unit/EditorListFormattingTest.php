<?php

namespace MicroWeb\TiptapEditor\Tests\Unit;

use MicroWeb\TiptapEditor\Services\EditorHtmlSanitizer;
use MicroWeb\TiptapEditor\Support\EditorHtmlPolicy;
use PHPUnit\Framework\TestCase;

final class EditorListFormattingTest extends TestCase
{
    public function test_nested_lists_and_numbered_start_are_preserved(): void
    {
        $html = '<ol start="7"><li><p><strong>Seven</strong></p><ul><li><p>Nested</p></li></ul></li><li><p>Eight</p></li></ol><p></p>';
        $sanitizer = new EditorHtmlSanitizer();
        self::assertSame($html, $sanitizer->sanitize($html));
        self::assertSame($html, $sanitizer->sanitize($sanitizer->sanitize($html)));
    }

    public function test_ordered_start_is_restricted_to_canonical_positive_decimal(): void
    {
        foreach (['1', '7', '99999'] as $value) {
            self::assertSame($value, EditorHtmlPolicy::attribute('ol', 'start', $value));
        }
        foreach (['0', '-1', '+1', '01', '1.5', '1e2', '100000', ' 1', "1\n", '7; color: red', ''] as $value) {
            self::assertNull(EditorHtmlPolicy::attribute('ol', 'start', $value));
        }
        foreach (['p', 'ul', 'li', 'div'] as $tag) {
            self::assertNull(EditorHtmlPolicy::attribute($tag, 'start', '7'));
        }
        self::assertSame('<ol><li><p>One</p></li></ol><p>Tail</p>', (new EditorHtmlSanitizer())->sanitize('<ol start="0"><li><p>One</p></li></ol><p start="7">Tail</p>'));
    }

    public function test_supported_alignment_survives_and_unsafe_style_is_removed(): void
    {
        $html = '<p style="text-align: left">Left</p><h2 style="text-align: center">Center</h2><p style="text-align: right">Right</p><p style="text-align: justify">Justify</p>';
        $sanitizer = new EditorHtmlSanitizer();
        self::assertSame($html, $sanitizer->sanitize($html));
        self::assertSame('<p style="text-align: center">Text</p>', $sanitizer->sanitize('<p style="text-align: center; position: fixed; background-image: url(https://example.com/a)">Text</p>'));
    }
}
