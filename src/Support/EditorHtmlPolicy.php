<?php

namespace MicroWeb\TiptapEditor\Support;

/** Value allowlists for editor HTML rendered into a normal HTML body. */
final class EditorHtmlPolicy
{
    private const CLASSES = [
        'mw-tiptap-image-figure', 'mw-tiptap-video-figure', 'mw-tiptap-video-frame',
        'mw-clear-media-wrap', 'mw-news-block', 'mw-news-block-card', 'mw-news-block-compact',
        'mw-news-block-featured', 'mw-news-block-media', 'mw-news-block-content',
        'mw-news-block-category', 'mw-news-block-title', 'mw-news-block-excerpt', 'mw-news-block-link',
        'tableWrapper',
    ];

    public static function url(string $value, bool $fragment = false, bool $relative = true): ?string
    {
        // Reject browser-normalized whitespace/control characters and backslashes.
        $value = trim($value, ' ');
        if ($value === '' || strlen($value) > 4096 || str_contains($value, '\\')
            || preg_match('/[\p{C}\p{Z}]/u', $value) !== 0) {
            return null;
        }
        if ($fragment && str_starts_with($value, '#')) {
            return $value;
        }
        if ($relative && str_starts_with($value, '/') && ! str_starts_with($value, '//')) {
            return $value;
        }
        if (! preg_match('~\Ahttps?://~i', $value) || filter_var($value, FILTER_VALIDATE_URL) === false) {
            return null;
        }
        $parts = parse_url($value);
        if ($parts === false || ! isset($parts['host']) || isset($parts['user']) || isset($parts['pass'])) {
            return null;
        }

        return $value;
    }

    public static function videoUrl(string $value): ?string
    {
        $value = self::url($value, relative: false);
        if ($value === null) {
            return null;
        }
        $parts = parse_url($value);
        if (strtolower($parts['scheme'] ?? '') !== 'https' || isset($parts['port']) || isset($parts['fragment'])) {
            return null;
        }
        $host = strtolower($parts['host'] ?? '');
        $path = $parts['path'] ?? '';
        $youtube = in_array($host, ['youtube.com', 'www.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'], true)
            && preg_match('~\A/embed/[A-Za-z0-9_-]{11}\z~', $path) === 1;
        $vimeo = $host === 'player.vimeo.com' && preg_match('~\A/video/[0-9]{1,20}\z~', $path) === 1;

        return $youtube || $vimeo ? $value : null;
    }

    public static function style(string $style): ?string
    {
        if (strlen($style) > 8192) {
            return null;
        }
        $safe = [];
        foreach (explode(';', $style) as $declaration) {
            if (! str_contains($declaration, ':')) {
                continue;
            }
            [$name, $value] = array_map('trim', explode(':', $declaration, 2));
            $name = strtolower($name);
            if ($value === '' || strlen($value) > 128) {
                continue;
            }
            $valid = match ($name) {
                'text-align' => self::oneOf($value, ['left', 'center', 'right', 'justify', 'start', 'end']),
                'vertical-align' => self::oneOf($value, ['top', 'middle', 'bottom', 'baseline']),
                'clear' => self::oneOf($value, ['none', 'left', 'right', 'both']),
                'background-color', 'color', 'border-color', '--mw-table-border-color' => self::color($value),
                'width', 'max-width', '--mw-media-width' => self::length($value, true),
                'margin-left', 'margin-right' => self::length($value, true),
                'border-width', '--mw-table-border-width' => self::length($value, false),
                'padding', '--mw-table-cell-padding' => self::lengthList($value),
                'border-style', '--mw-table-border-style' => self::oneOf($value, ['none', 'solid', 'dashed', 'dotted', 'double']),
                default => false,
            };
            if ($valid) {
                $safe[$name] = $value;
            }
        }
        $result = [];
        foreach ($safe as $name => $value) {
            $result[] = $name.': '.$value;
        }

        return $result === [] ? null : implode('; ', $result);
    }

    /** Return only approved values for an attribute on this element. */
    public static function attribute(string $tag, string $name, string $value): ?string
    {
        if ($name === 'class') {
            $classes = preg_split('/\s+/', trim($value)) ?: [];
            $classes = array_unique(array_intersect($classes, self::CLASSES));
            return $classes === [] ? null : implode(' ', $classes);
        }
        if ($name === 'style') {
            return self::style($value);
        }
        if ($name === 'title' || ($name === 'alt' && $tag === 'img')) {
            return $value;
        }
        if ($tag === 'a') {
            if ($name === 'href') {
                return self::url($value, fragment: true);
            }
            if ($name === 'rel') {
                $tokens = preg_split('/\s+/', strtolower(trim($value))) ?: [];
                $tokens = array_unique(array_intersect($tokens, ['noopener', 'noreferrer', 'nofollow', 'ugc', 'sponsored', 'external']));
                return $tokens === [] ? null : implode(' ', $tokens);
            }
            if ($name === 'target') {
                return self::oneOf($value, ['_self', '_blank']) ? strtolower($value) : null;
            }
        }
        if ($tag === 'img') {
            if ($name === 'src') {
                return self::url($value);
            }
            if ($name === 'loading' && self::oneOf($value, ['lazy', 'eager'])) {
                return strtolower($value);
            }
            if ($name === 'decoding' && self::oneOf($value, ['async', 'sync', 'auto'])) {
                return strtolower($value);
            }
        }
        if (in_array($tag, ['td', 'th'], true) && in_array($name, ['rowspan', 'colspan'], true)) {
            return self::integer($value, 1, 1000) ? $value : null;
        }
        if (in_array($tag, ['td', 'th'], true) && in_array($name, ['colwidth', 'data-colwidth'], true)) {
            if (strlen($value) > 1024 || ! preg_match('/\A[0-9]{1,5}(?:,[0-9]{1,5})*\z/', $value)) {
                return null;
            }
            return $value;
        }
        if ($name === 'data-mw-path' && in_array($tag, ['img', 'figure'], true)) {
            return $value === '' || MediaPath::isCanonical($value) ? $value : null;
        }
        if ($tag === 'figure') {
            return match ($name) {
                'data-mw-image', 'data-mw-video' => self::marker($value),
                'data-align' => self::oneOf($value, ['left', 'center', 'right']) ? $value : null,
                'data-width' => self::number($value, 1, 100) ? $value : null,
                'data-wrap' => self::oneOf($value, ['true', 'false']) ? $value : null,
                'data-provider' => self::oneOf($value, ['youtube', 'vimeo']) ? $value : null,
                default => null,
            };
        }
        if ($tag === 'article') {
            return match ($name) {
                'data-mw-news-block' => self::marker($value),
                'data-url' => $value === '' ? '' : self::url($value, fragment: true),
                'data-thumbnail' => $value === '' ? '' : self::url($value),
                'data-title', 'data-category', 'data-excerpt', 'data-news-id' => $value,
                'data-style' => self::oneOf($value, ['card', 'compact', 'featured']) ? $value : null,
                default => null,
            };
        }
        if ($tag === 'span' && $name === 'data-mw-news-category'
            || $tag === 'h3' && $name === 'data-mw-news-title'
            || $tag === 'p' && $name === 'data-mw-news-excerpt'
            || in_array($tag, ['div', 'p'], true) && $name === 'data-clear-float') {
            return self::marker($value);
        }
        if ($tag === 'table') {
            return match ($name) {
                'data-mw-table-properties' => self::marker($value),
                'data-width-mode' => self::oneOf($value, ['auto', '50', '75', 'full']) ? $value : null,
                'data-table-align' => self::oneOf($value, ['left', 'center', 'right']) ? $value : null,
                'data-border-color' => self::color($value) ? $value : null,
                'data-border-width' => self::number($value, 0, 100) ? $value : null,
                'data-border-style' => self::oneOf($value, ['solid', 'dashed', 'dotted']) ? $value : null,
                'data-cell-padding' => self::number($value, 0, 100) ? $value : null,
                default => null,
            };
        }

        return null;
    }

    private static function oneOf(string $value, array $values): bool
    {
        return in_array(strtolower($value), $values, true);
    }

    private static function marker(string $value): ?string
    {
        return in_array($value, ['', 'true', 'false'], true) ? $value : null;
    }

    private static function integer(string $value, int $min, int $max): bool
    {
        return preg_match('/\A[0-9]{1,5}\z/', $value) === 1 && (int) $value >= $min && (int) $value <= $max;
    }

    private static function number(string $value, int $min, int $max): bool
    {
        return preg_match('/\A(?:[0-9]{1,5}(?:\.[0-9]{1,4})?|\.[0-9]{1,4})\z/', $value) === 1
            && (float) $value >= $min && (float) $value <= $max;
    }

    private static function color(string $value): bool
    {
        // Restricted token grammar: no escapes, nested functions, comments or var().
        return preg_match('/\A(?:#[a-f0-9]{3}(?:[a-f0-9])?|#[a-f0-9]{6}(?:[a-f0-9]{2})?|[a-z]{1,32}|(?:rgba?|hsla?)\([0-9.,% +\/-]{1,64}\))\z/i', $value) === 1;
    }

    private static function length(string $value, bool $allowAuto): bool
    {
        if ($allowAuto && self::oneOf($value, ['auto', 'none'])) {
            return true;
        }
        if ($value === '0') {
            return true;
        }
        if (! preg_match('/\A([0-9]{1,5}(?:\.[0-9]{1,4})?|\.[0-9]{1,4})(px|%|em|rem)\z/i', $value, $match)) {
            return false;
        }
        return (float) $match[1] <= (strtolower($match[2]) === 'px' ? 10000 : 1000);
    }

    private static function lengthList(string $value): bool
    {
        $parts = preg_split('/ +/', $value) ?: [];
        if (count($parts) < 1 || count($parts) > 4) {
            return false;
        }
        foreach ($parts as $part) {
            if (! self::length($part, false)) {
                return false;
            }
        }
        return true;
    }
}
