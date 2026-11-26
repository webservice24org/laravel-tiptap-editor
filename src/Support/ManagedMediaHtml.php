<?php

namespace MicroWeb\TiptapEditor\Support;

use DOMDocument;
use DOMElement;
use DOMXPath;
use InvalidArgumentException;
use RuntimeException;

/** Structured reference editing for already sanitized editor HTML, not a sanitizer. */
final class ManagedMediaHtml
{
    private function __construct(
        private DOMDocument $document,
        private DOMElement $root
    ) {}

    public static function parse(string $html): self
    {
        if (preg_match('//u', $html) !== 1 || str_contains($html, "\0")) {
            throw new InvalidArgumentException('Editor media HTML must be valid UTF-8.');
        }

        $document = new DOMDocument('1.0', 'UTF-8');
        $marker = 'mw-media-'.bin2hex(random_bytes(16));
        $previous = libxml_use_internal_errors(true);
        try {
            $loaded = $document->loadHTML(
                '<!DOCTYPE html><html><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"></head>'
                .'<body><div id="'.$marker.'">'.$html.'</div></body></html>',
                LIBXML_NONET
            );
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }

        if (! $loaded) {
            throw new InvalidArgumentException('Unable to parse editor media HTML.');
        }

        $xpath = new DOMXPath($document);
        $roots = $xpath->query('/html/body/div[@id="'.$marker.'"]');
        $root = $roots === false ? null : $roots->item(0);
        if (! $root instanceof DOMElement || $roots->length !== 1) {
            throw new InvalidArgumentException('Invalid editor media fragment boundary.');
        }

        // Do not silently discard content that escaped the fragment wrapper.
        foreach ($root->parentNode->childNodes as $node) {
            if (! $node->isSameNode($root) && ($node->nodeType !== XML_TEXT_NODE || trim($node->nodeValue ?? '') !== '')) {
                throw new InvalidArgumentException('Editor media content escaped its fragment boundary.');
            }
        }
        $unexpectedHead = $xpath->query('/html/head/*[not(self::meta[@http-equiv="Content-Type"])]');
        if ($unexpectedHead === false || $unexpectedHead->length !== 0) {
            throw new InvalidArgumentException('Unexpected document metadata in editor fragment.');
        }

        return new self($document, $root);
    }

    /** @return array<string|int, list<DOMElement>> Canonical paths on actual elements, in document order. */
    public function references(): array
    {
        $result = [];
        $xpath = new DOMXPath($this->document);
        $nodes = $xpath->query('.//*[@data-mw-path]', $this->root);
        if ($nodes === false) {
            throw new RuntimeException('Unable to read editor media references.');
        }
        foreach ($nodes as $node) {
            if (! $node instanceof DOMElement) {
                continue;
            }
            $path = $node->getAttribute('data-mw-path');
            if (MediaPath::isCanonical($path)) {
                $result[$path][] = $node;
            }
        }

        return $result;
    }

    /** Resolve one image attached to a recognized temporary reference. */
    public static function imageFor(DOMElement $node): DOMElement
    {
        // No nested managed references: a child cannot be rewritten twice or
        // claim a separate upload inside another managed figure.
        for ($parent = $node->parentNode; $parent instanceof DOMElement; $parent = $parent->parentNode) {
            if ($parent->hasAttribute('data-mw-path') && $parent->getAttribute('data-mw-path') !== '') {
                throw new InvalidArgumentException('Nested managed media references are not supported.');
            }
        }

        if ($node->tagName === 'img') {
            return $node;
        }

        if ($node->tagName !== 'figure' || ! $node->hasAttribute('data-mw-image')) {
            throw new InvalidArgumentException('Temporary media must reference a managed image figure or image.');
        }

        $images = $node->getElementsByTagName('img');
        $image = $images->item(0);
        if ($images->length !== 1 || ! $image instanceof DOMElement
            || ! $image->parentNode->isSameNode($node)) {
            throw new InvalidArgumentException('A managed figure must contain one direct image.');
        }
        foreach ($node->getElementsByTagName('*') as $child) {
            if ($child instanceof DOMElement && $child->hasAttribute('data-mw-path') && $child->getAttribute('data-mw-path') !== '') {
                throw new InvalidArgumentException('Nested managed media references are not supported.');
            }
        }

        return $image;
    }

    public function html(): string
    {
        $html = '';
        foreach ($this->root->childNodes as $node) {
            $fragment = $this->document->saveHTML($node);
            if ($fragment === false) {
                throw new RuntimeException('Unable to serialize editor media HTML.');
            }
            $html .= $fragment;
        }

        return $html;
    }
}
