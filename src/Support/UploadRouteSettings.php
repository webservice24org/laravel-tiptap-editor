<?php

namespace MicroWeb\TiptapEditor\Support;

use InvalidArgumentException;

final class UploadRouteSettings
{
    public const LIMITER = 'microweb-tiptap-editor-upload';

    public static function guard(): string
    {
        return self::identifier('guard', 'web');
    }

    public static function ability(): string
    {
        return self::identifier('ability', 'tiptap-editor.upload');
    }

    public static function attemptsPerMinute(): int
    {
        $value = config('tiptap-editor.upload_route.attempts_per_minute', 20);
        if ((! is_int($value) && ! is_string($value)) ||
            filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 1000]]) === false) {
            throw new InvalidArgumentException('Tiptap upload attempts_per_minute must be an integer from 1 to 1000.');
        }

        return (int) $value;
    }

    public static function middleware(): array
    {
        $extra = config('tiptap-editor.upload_route.additional_middleware', []);
        if (! is_array($extra) || ! array_is_list($extra)) {
            throw new InvalidArgumentException('Tiptap upload additional_middleware must be a list of middleware strings.');
        }
        foreach ($extra as $middleware) {
            if (! is_string($middleware) || trim($middleware) === '') {
                throw new InvalidArgumentException('Tiptap upload additional_middleware must contain non-empty strings.');
            }
        }

        // Host middleware is additive; a missing or empty list cannot remove
        // the mandatory session/CSRF, authentication, throttle or Gate checks.
        return array_values(array_unique([
            'web',
            'auth:'.self::guard(),
            'throttle:'.self::LIMITER,
            'can:'.self::ability(),
            ...$extra,
        ]));
    }

    private static function identifier(string $key, string $default): string
    {
        $value = config('tiptap-editor.upload_route.'.$key, $default);
        // Commas, whitespace and empty names are not valid middleware arguments.
        if (! is_string($value) || preg_match('/\A[A-Za-z0-9_.-]+\z/D', $value) !== 1) {
            throw new InvalidArgumentException('Invalid Tiptap upload route '.$key.'.');
        }

        return $value;
    }
}
