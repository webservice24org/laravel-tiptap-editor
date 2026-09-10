<?php

namespace MicroWeb\TiptapEditor\Services;

use DOMDocument;
use DOMElement;
use DOMNode;
use DOMXPath;

class EditorHtmlSanitizer
{
    private array $allowedTags = [
        'p',
        'br',
        'strong',
        'b',
        'em',
        'i',
        'u',
        's',
        'sub',
        'sup',
        'h1',
        'h2',
        'h3',
        'ul',
        'ol',
        'li',
        'blockquote',
        'hr',
        'a',
        'span',
        'div',
        'figure',
        'figcaption',
        'img',
        'iframe',
        'article',
        'table',
        'thead',
        'tbody',
        'tfoot',
        'tr',
        'th',
        'td',
        'colgroup',
        'col',
    ];

    private array $allowedAttributes = [
        'href',
        'target',
        'rel',
        'src',
        'alt',
        'title',
        'class',
        'style',
        'loading',
        'decoding',
        'allow',
        'allowfullscreen',
        'referrerpolicy',
        'rowspan',
        'colspan',
        'colwidth',

        'data-align',
        'data-category',
        'data-clear-float',
        'data-colwidth',
        'data-excerpt',
        'data-mw-image',
        'data-mw-video',
        'data-mw-news-block',
        'data-mw-news-category',
        'data-mw-news-excerpt',
        'data-mw-news-title',
        'data-mw-path',
        'data-mw-table-properties',
        'data-news-id',
        'data-provider',
        'data-style',
        'data-table-align',
        'data-thumbnail',
        'data-title',
        'data-url',
        'data-width',
        'data-width-mode',
        'data-wrap',
        'data-border-color',
        'data-border-width',
        'data-border-style',
        'data-cell-padding',
    ];

    private array $allowedIframeHosts = [
        'youtube.com',
        'www.youtube.com',
        'youtube-nocookie.com',
        'www.youtube-nocookie.com',
        'player.vimeo.com',
    ];

    private array $allowedStyleProperties = [
        'text-align',
        'vertical-align',
        'background-color',
        'color',
        'width',
        'max-width',
        'margin-left',
        'margin-right',
        'clear',
        'border-width',
        'border-style',
        'border-color',
        'padding',
        '--mw-table-border-color',
        '--mw-table-border-width',
        '--mw-table-border-style',
        '--mw-table-cell-padding',
        '--mw-media-width',
    ];

    public function sanitize(?string $html): string
    {
        $html = trim((string) $html);

        if ($html === '') {
            return '';
        }

        $previous = libxml_use_internal_errors(true);

        $document = new DOMDocument(
            '1.0',
            'UTF-8'
        );

        $document->loadHTML(
            '<?xml encoding="UTF-8">'
            .'<div id="mw-editor-root">'
            .$html
            .'</div>',
            LIBXML_HTML_NOIMPLIED
            | LIBXML_HTML_NODEFDTD
        );

        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        $xpath = new DOMXPath($document);

        foreach (
            iterator_to_array(
                $xpath->query(
                    '//*[@id="mw-editor-root"]//*'
                )
            )
            as $node
        ) {
            if (! $node instanceof DOMElement) {
                continue;
            }

            $this->sanitizeElement(
                $node
            );
        }

        $root = $document
            ->getElementById(
                'mw-editor-root'
            );

        if (! $root) {
            return '';
        }

        $output = '';

        foreach (
            iterator_to_array(
                $root->childNodes
            )
            as $child
        ) {
            $output .=
                $document->saveHTML(
                    $child
                );
        }

        return $output;
    }

    private function sanitizeElement(
        DOMElement $element
    ): void {
        $tag = strtolower(
            $element->tagName
        );

        if (
            ! in_array(
                $tag,
                $this->allowedTags,
                true
            )
        ) {
            $this->unwrapElement(
                $element
            );

            return;
        }

        foreach (
            iterator_to_array(
                $element->attributes
            )
            as $attribute
        ) {
            $name = strtolower(
                $attribute->name
            );

            if (
                str_starts_with(
                    $name,
                    'on'
                )
                ||
                ! in_array(
                    $name,
                    $this->allowedAttributes,
                    true
                )
            ) {
                $element
                    ->removeAttribute(
                        $attribute->name
                    );

                continue;
            }

            $value =
                trim(
                    $attribute->value
                );

            if (
                in_array(
                    $name,
                    ['href', 'src'],
                    true
                )
            ) {
                if (
                    ! $this->isSafeUrl(
                        $value,
                        $tag === 'iframe'
                            ? false
                            : true
                    )
                ) {
                    $element
                        ->removeAttribute(
                            $attribute->name
                        );

                    continue;
                }
            }

            if (
                $tag === 'iframe'
                &&
                $name === 'src'
                &&
                ! $this
                    ->isAllowedIframeUrl(
                        $value
                    )
            ) {
                $element
                    ->removeAttribute(
                        'src'
                    );

                continue;
            }

            if (
                $name === 'style'
            ) {
                $style =
                    $this
                        ->sanitizeStyle(
                            $value
                        );

                if ($style === '') {
                    $element
                        ->removeAttribute(
                            'style'
                        );
                } else {
                    $element
                        ->setAttribute(
                            'style',
                            $style
                        );
                }
            }
        }

        if (
            $tag === 'a'
            &&
            $element->getAttribute(
                'target'
            ) === '_blank'
        ) {
            $element->setAttribute(
                'rel',
                'noopener noreferrer'
            );
        }

        if (
            $tag === 'iframe'
            &&
            ! $element
                ->hasAttribute(
                    'src'
                )
        ) {
            $element
                ->parentNode
                ?->removeChild(
                    $element
                );
        }
    }

    private function unwrapElement(
        DOMElement $element
    ): void {
        $parent =
            $element->parentNode;

        if (! $parent) {
            return;
        }

        while (
            $element->firstChild
        ) {
            $parent->insertBefore(
                $element->firstChild,
                $element
            );
        }

        $parent->removeChild(
            $element
        );
    }

    private function isSafeUrl(
        string $url,
        bool $allowRelative
    ): bool {
        if ($url === '') {
            return false;
        }

        if (
            $allowRelative
            &&
            (
                str_starts_with(
                    $url,
                    '/'
                )
                ||
                str_starts_with(
                    $url,
                    '#'
                )
            )
        ) {
            return true;
        }

        $scheme =
            strtolower(
                (string)
                parse_url(
                    $url,
                    PHP_URL_SCHEME
                )
            );

        return in_array(
            $scheme,
            ['http', 'https'],
            true
        );
    }

    private function isAllowedIframeUrl(
        string $url
    ): bool {
        $host =
            strtolower(
                (string)
                parse_url(
                    $url,
                    PHP_URL_HOST
                )
            );

        return in_array(
            $host,
            $this->allowedIframeHosts,
            true
        );
    }

    private function sanitizeStyle(
        string $style
    ): string {
        $safe = [];

        foreach (
            explode(
                ';',
                $style
            )
            as $declaration
        ) {
            $declaration =
                trim(
                    $declaration
                );

            if (
                $declaration === ''
                ||
                ! str_contains(
                    $declaration,
                    ':'
                )
            ) {
                continue;
            }

            [
                $property,
                $value,
            ] =
                array_map(
                    'trim',
                    explode(
                        ':',
                        $declaration,
                        2
                    )
                );

            $property =
                strtolower(
                    $property
                );

            if (
                ! in_array(
                    $property,
                    $this
                        ->allowedStyleProperties,
                    true
                )
            ) {
                continue;
            }

            if (
                preg_match(
                    '/url\s*\(|expression\s*\(|javascript:|vbscript:|data:/i',
                    $value
                )
            ) {
                continue;
            }

            $safe[] =
                $property
                .': '
                .$value;
        }

        return implode(
            '; ',
            $safe
        );
    }
}
