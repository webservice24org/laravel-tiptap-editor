<?php

namespace MicroWeb\TiptapEditor\Services;

use DOMDocument;
use DOMNode;
use InvalidArgumentException;
use MicroWeb\TiptapEditor\Support\EditorHtmlPolicy;

/** Sanitizes rich HTML for a normal HTML body, not a JS/CSS/attribute context. */
class EditorHtmlSanitizer
{
    private const TAGS = [
        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'h1', 'h2', 'h3',
        'ul', 'ol', 'li', 'blockquote', 'hr', 'a', 'span', 'div', 'figure', 'figcaption',
        'img', 'iframe', 'article', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'colgroup', 'col',
    ];
    private const VOID_TAGS = ['br', 'hr', 'img', 'col'];
    private const DROP_SUBTREE = [
        'script', 'style', 'svg', 'math', 'template', 'noscript', 'object', 'embed', 'applet',
        'form', 'input', 'button', 'textarea', 'select', 'option', 'optgroup', 'base', 'link', 'meta',
        'title', 'xmp', 'plaintext', 'noembed', 'noframes', 'frame', 'frameset', 'portal',
    ];
    private const MAX_BYTES = 2097152;
    private const MAX_NODES = 20000;
    private const MAX_DEPTH = 100;

    public function sanitize(?string $html): string
    {
        $html = (string) $html;
        if (strlen($html) > self::MAX_BYTES || preg_match('//u', $html) !== 1 || str_contains($html, "\0")) {
            throw new InvalidArgumentException('Editor HTML must be valid UTF-8 and no larger than 2 MiB.');
        }
        $html = trim($html);
        if ($html === '') {
            return '';
        }

        $source = '<!DOCTYPE html><html><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"></head><body>'.$html.'</body></html>';
        $previous = libxml_use_internal_errors(true);
        try {
            if (class_exists(\Dom\HTMLDocument::class)) {
                // PHP 8.4+ offers the HTML5 parsing algorithm. Do not disable namespaces.
                $document = \Dom\HTMLDocument::createFromString($source, LIBXML_NOERROR, 'UTF-8');
            } else {
                // PHP 8.2/8.3: extract a tree only; never serialize untrusted DOM nodes.
                $document = new DOMDocument('1.0', 'UTF-8');
                if (! $document->loadHTML($source, LIBXML_NONET)) {
                    throw new InvalidArgumentException('Unable to parse editor HTML.');
                }
            }
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }
        $body = $document->getElementsByTagName('body')->item(0);
        if ($body === null) {
            return '';
        }
        $count = 0;
        return $this->children($body, 0, $count);
    }

    private function children(DOMNode|\Dom\Node $parent, int $depth, int &$count): string
    {
        $result = '';
        foreach ($parent->childNodes as $node) {
            $result .= $this->render($node, $depth + 1, $count);
        }
        return $result;
    }

    private function render(DOMNode|\Dom\Node $node, int $depth, int &$count): string
    {
        if (++$count > self::MAX_NODES || $depth > self::MAX_DEPTH) {
            throw new InvalidArgumentException('Editor HTML is too complex.');
        }
        if ($node->nodeType === XML_TEXT_NODE) {
            return self::escape($node->nodeValue ?? '');
        }
        // No comments, CDATA, processing instructions or non-element markup.
        if (! $node instanceof \DOMElement && ! $node instanceof \Dom\Element) {
            return '';
        }
        $tag = strtolower($node->tagName);
        if (($node->namespaceURI !== null && $node->namespaceURI !== '' && $node->namespaceURI !== 'http://www.w3.org/1999/xhtml')
            || str_contains($tag, ':') || in_array($tag, self::DROP_SUBTREE, true)) {
            return '';
        }
        if (! in_array($tag, self::TAGS, true)) {
            return $this->children($node, $depth, $count);
        }
        if ($tag === 'iframe') {
            $url = EditorHtmlPolicy::videoUrl($node->getAttribute('src') ?? '');
            if ($url === null) {
                return '';
            }
            // Never copy untrusted iframe permissions, fallback HTML or srcdoc.
            return '<iframe src="'.self::escape($url).'" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen="true" referrerpolicy="strict-origin-when-cross-origin"></iframe>';
        }

        $attributes = [];
        foreach ($node->attributes as $attribute) {
            $name = strtolower($attribute->name);
            if ($attribute->namespaceURI !== null && $attribute->namespaceURI !== '') {
                continue;
            }
            $value = EditorHtmlPolicy::attribute($tag, $name, $attribute->value);
            if ($value !== null) {
                $attributes[$name] = $value;
            }
        }
        if ($tag === 'a') {
            if (! isset($attributes['href'])) {
                unset($attributes['target'], $attributes['rel']);
            } elseif (($attributes['target'] ?? '') === '_blank') {
                $attributes['rel'] = implode(' ', array_unique(array_merge(
                    ['noopener', 'noreferrer'],
                    explode(' ', $attributes['rel'] ?? 'noopener')
                )));
            }
        }
        if ($tag === 'img' && ! isset($attributes['src'])) {
            return '';
        }
        $result = '<'.$tag;
        foreach ($attributes as $name => $value) {
            $result .= ' '.$name.'="'.self::escape($value).'"';
        }
        $result .= '>';
        return in_array($tag, self::VOID_TAGS, true)
            ? $result
            : $result.$this->children($node, $depth, $count).'</'.$tag.'>';
    }

    private static function escape(string $value): string
    {
        // Always double encode decoded DOM values. Never copy source markup.
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML5, 'UTF-8', true);
    }
}
