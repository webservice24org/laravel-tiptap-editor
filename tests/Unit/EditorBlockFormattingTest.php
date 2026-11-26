<?php

namespace MicroWeb\TiptapEditor\Tests\Unit;

use MicroWeb\TiptapEditor\Services\EditorHtmlSanitizer;
use PHPUnit\Framework\TestCase;

final class EditorBlockFormattingTest extends TestCase
{
    public function test_plain_code_markup_and_escaped_text_are_preserved(): void
    {
        $html = "<p><code>&lt;x&gt; &amp; y</code></p><pre><code>line 1\n  line 2 &lt;tag&gt;</code></pre>";
        $sanitizer = new EditorHtmlSanitizer();
        self::assertSame($html, $sanitizer->sanitize($html));
        self::assertSame($html, $sanitizer->sanitize($sanitizer->sanitize($html)));
    }

    public function test_block_elements_and_inline_marks_are_preserved(): void
    {
        $html = '<h1>One</h1><h2>Two</h2><h3>Three</h3><blockquote><p><strong>Quote</strong></p></blockquote><hr><p>After</p>';
        self::assertSame($html, (new EditorHtmlSanitizer())->sanitize($html));
    }

    public function test_code_tags_do_not_allow_active_elements_or_new_attributes(): void
    {
        $html = '<pre onclick="bad()"><code id="bad" onmouseover="bad()">&lt;script&gt;safe text&lt;/script&gt;<script>bad()</script></code></pre>';
        self::assertSame('<pre><code>&lt;script&gt;safe text&lt;/script&gt;</code></pre>', (new EditorHtmlSanitizer())->sanitize($html));
    }
}
