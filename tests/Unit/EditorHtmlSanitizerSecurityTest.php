<?php

namespace MicroWeb\TiptapEditor\Tests\Unit;

use InvalidArgumentException;
use MicroWeb\TiptapEditor\Services\EditorHtmlSanitizer;
use PHPUnit\Framework\TestCase;

final class EditorHtmlSanitizerSecurityTest extends TestCase
{
    private function sanitize(string $html): string
    {
        return (new EditorHtmlSanitizer())->sanitize($html);
    }

    public function test_active_elements_and_foreign_subtrees_are_removed(): void
    {
        $result = $this->sanitize('<p>Before</p><script>badScript()</script><style>badStyle</style>'
            .'<svg><foreignObject><p>foreign content</p></foreignObject></svg><math><mi>math content</mi></math>'
            .'<form action="/bad"><input name="x"><button>Submit</button></form><object data="/x">object content</object>'
            .'<template><p>template content</p></template><p>After</p>');
        self::assertStringContainsString('<p>Before</p>', $result);
        self::assertStringContainsString('<p>After</p>', $result);
        foreach (['<script', 'badScript', '<style', 'badStyle', '<svg', '<math', '<form', '<input', '<button', '<object', '<template'] as $value) {
            self::assertStringNotContainsString($value, $result);
        }
    }

    public function test_event_handlers_clobbering_and_unapproved_attributes_are_removed(): void
    {
        $result = $this->sanitize('<p id="mw-editor-root" name="location" data-extra="x" onclick="bad()">Hi</p>'
            .'<img src="/image.png" onerror="bad()" srcset="/other.png" alt="Safe">');
        self::assertSame('<p>Hi</p><img src="/image.png" alt="Safe">', $result);
    }

    public function test_urls_are_checked_after_entity_decoding_and_blank_links_are_safe(): void
    {
        $result = $this->sanitize('<a href="java&#x09;script:bad()" target="_blank">Bad</a>'
            .'<a href="//example.com/" target="_blank">Other</a>'
            .'<a href="/news?a=1&amp;b=2" target="_blank" rel="opener nofollow">Safe</a>'
            .'<img src="data:image/svg+xml,test"><img src="/ok.png">');
        self::assertStringContainsString('<a>Bad</a><a>Other</a>', $result);
        self::assertStringContainsString('href="/news?a=1&amp;b=2"', $result);
        self::assertStringContainsString('rel="noopener noreferrer nofollow"', $result);
        self::assertStringNotContainsString('data:image', $result);
        self::assertStringContainsString('<img src="/ok.png">', $result);
    }

    public function test_iframe_permissions_are_rebuilt_and_invalid_embeds_removed(): void
    {
        $result = $this->sanitize('<figure data-mw-video="" data-provider="youtube" data-width="75"><div class="mw-tiptap-video-frame">'
            .'<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" srcdoc="bad" allow="camera; microphone" onload="bad()"></iframe></div>'
            .'<figcaption>Video</figcaption></figure><iframe src="https://youtube.com.evil.example/embed/dQw4w9WgXcQ"></iframe>');
        self::assertSame(1, substr_count($result, '<iframe'));
        self::assertStringContainsString('allow="encrypted-media; picture-in-picture; fullscreen"', $result);
        self::assertStringContainsString('allowfullscreen="true"', $result);
        self::assertStringContainsString('<figcaption>Video</figcaption>', $result);
        foreach (['srcdoc', 'camera', 'microphone', 'onload', 'evil.example'] as $value) {
            self::assertStringNotContainsString($value, $result);
        }
    }

    public function test_news_block_metadata_urls_and_text_are_validated(): void
    {
        $result = $this->sanitize('<article class="mw-news-block mw-news-block-card fixed" data-mw-news-block="true" data-title="News &amp; more" '
            .'data-url="javascript:bad()" data-thumbnail="//example.com/x" data-style="card" data-news-id="news-1">'
            .'<a href="/news/1" class="mw-news-block-link"><h3 data-mw-news-title="true">News &amp; more</h3></a></article>');
        self::assertStringContainsString('class="mw-news-block mw-news-block-card"', $result);
        self::assertStringContainsString('data-title="News &amp; more"', $result);
        self::assertStringContainsString('data-news-id="news-1"', $result);
        self::assertStringContainsString('href="/news/1"', $result);
        self::assertStringNotContainsString('data-url=', $result);
        self::assertStringNotContainsString('data-thumbnail=', $result);
    }

    public function test_safe_news_urls_and_table_styles_survive(): void
    {
        $result = $this->sanitize('<article data-mw-news-block="true" data-url="/news/1" data-thumbnail="/thumb.jpg" data-style="featured">'
            .'<p data-mw-news-excerpt="true">News</p></article>'
            .'<table data-mw-table-properties="true" data-width-mode="75" data-table-align="center" data-border-color="#d4d4d4" data-border-width="1" '
            .'data-border-style="dashed" data-cell-padding="10" style="width: 75%; margin-left: auto; --mw-table-border-color: #d4d4d4; --mw-table-cell-padding: 10px; position: fixed">'
            .'<tbody><tr><td colspan="2" colwidth="120,240" style="vertical-align: middle; background-color: rgb(12, 34, 56)">Cell</td></tr></tbody></table>');
        foreach (['data-url="/news/1"', 'data-thumbnail="/thumb.jpg"', 'data-width-mode="75"', 'data-border-style="dashed"', '--mw-table-cell-padding: 10px', 'colspan="2"', 'colwidth="120,240"', 'vertical-align: middle', 'background-color: rgb(12, 34, 56)'] as $value) {
            self::assertStringContainsString($value, $result);
        }
        self::assertStringNotContainsString('position:', $result);
    }

    public function test_managed_image_markup_and_bengali_text_survive(): void
    {
        $path = 'editor/tmp/owner-'.str_repeat('a', 64).'/image.png';
        $html = '<p><strong>বাংলা &amp; café</strong></p><figure data-mw-image="" data-mw-path="'.$path.'" data-align="left" data-width="50" data-wrap="true" '
            .'class="mw-tiptap-image-figure" style="--mw-media-width: 50%"><img src="/storage/'.$path.'" alt="বাংলা ছবি" loading="lazy" style="width: 100%">'
            .'<figcaption>ছবি</figcaption></figure>';
        $result = $this->sanitize($html);
        self::assertStringContainsString('<strong>বাংলা &amp; café</strong>', $result);
        self::assertStringContainsString('data-mw-path="'.$path.'"', $result);
        self::assertStringContainsString('data-width="50"', $result);
        self::assertStringContainsString('--mw-media-width: 50%', $result);
        self::assertStringContainsString('alt="বাংলা ছবি"', $result);
        self::assertStringContainsString('<figcaption>ছবি</figcaption>', $result);
        self::assertSame($result, $this->sanitize($result));
    }

    public function test_untrusted_text_and_attributes_cannot_become_markup(): void
    {
        $result = $this->sanitize('<p title="&quot;&gt;&lt;img src=x onerror=bad()&gt;">&lt;script&gt; &amp;lt;img&amp;gt;</p>');
        self::assertStringContainsString('title="&quot;&gt;&lt;img src=x onerror=bad()&gt;"', $result);
        self::assertStringContainsString('&lt;script&gt; &amp;lt;img&amp;gt;', $result);
        self::assertStringNotContainsString('<img', $result);
        self::assertStringNotContainsString('<script', $result);
        self::assertSame($result, $this->sanitize($result));
    }

    public function test_malformed_fragment_cannot_inject_document_markup(): void
    {
        $result = $this->sanitize('<p>Safe</p></body><head><base href="https://evil.example/"><meta http-equiv="refresh" content="0"></head><body onload="bad()"><p>More</p><!--hidden--><p><b>Unclosed');
        self::assertStringContainsString('Safe', $result);
        foreach (['<head', '<body', '<base', '<meta', 'onload=', '<!--'] as $value) {
            self::assertStringNotContainsString($value, $result);
        }
    }

    public function test_oversized_html_is_rejected(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->sanitize(str_repeat('a', 2097153));
    }

    public function test_invalid_utf8_is_rejected(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->sanitize("\xff");
    }

    public function test_complex_markup_is_rejected(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->sanitize(str_repeat('<div>', 120).'text'.str_repeat('</div>', 120));
    }
}
