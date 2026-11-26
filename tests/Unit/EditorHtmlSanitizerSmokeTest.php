<?php

namespace MicroWeb\TiptapEditor\Tests\Unit;

use MicroWeb\TiptapEditor\Services\EditorHtmlSanitizer;
use PHPUnit\Framework\TestCase;

final class EditorHtmlSanitizerSmokeTest extends TestCase
{
    public function test_empty_content_remains_empty(): void
    {
        $sanitizer = new EditorHtmlSanitizer();

        self::assertSame('', $sanitizer->sanitize(null));
        self::assertSame('', $sanitizer->sanitize('   '));
    }

    public function test_supported_formatting_survives_sanitization(): void
    {
        $html = '<p>Hello <strong>world</strong>.</p><ul><li>First</li></ul>';
        $sanitized = (new EditorHtmlSanitizer())->sanitize($html);

        self::assertStringContainsString('<strong>world</strong>', $sanitized);
        self::assertStringContainsString('<li>First</li>', $sanitized);
    }

    public function test_basic_event_handler_is_removed(): void
    {
        $sanitized = (new EditorHtmlSanitizer())->sanitize('<p onclick="alert(1)">Safe text</p>');

        self::assertStringContainsString('Safe text', $sanitized);
        self::assertStringNotContainsString('onclick', $sanitized);
    }
}
