<?php

namespace MicroWeb\TiptapEditor\Support;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Auth;
use InvalidArgumentException;
use LogicException;

/** Server-derived ownership scope for temporary uploads; not a public access token. */
final class TemporaryMediaOwner
{
    public static function directory(?string $guard = null): string
    {
        $guard ??= UploadRouteSettings::guard();
        if (preg_match('/\A[A-Za-z0-9_.-]+\z/D', $guard) !== 1) {
            throw new InvalidArgumentException('Invalid editor media ownership guard.');
        }

        $user = Auth::guard($guard)->user();
        $identifier = $user?->getAuthIdentifier();
        if ($user === null || (! is_int($identifier) && ! is_string($identifier)) || (string) $identifier === '') {
            throw new AuthorizationException('Temporary editor media requires an authenticated owner.');
        }

        $key = config('app.key');
        if (is_string($key) && str_starts_with($key, 'base64:')) {
            $key = base64_decode(substr($key, 7), true);
        }
        if (! is_string($key) || strlen($key) < 16) {
            throw new LogicException('A valid application key is required for editor media ownership.');
        }

        // The guard and model class isolate distinct authentication realms.
        // Length-safe JSON framing prevents ambiguous concatenation of identifiers.
        $identity = json_encode([
            'microweb-tiptap-temporary-media-v1',
            $guard,
            get_class($user),
            (string) $identifier,
        ], JSON_THROW_ON_ERROR);

        return MediaPath::requireDirectory(
            MediaPath::directories()['temporary'].'/owner-'.hash_hmac('sha256', $identity, $key)
        );
    }

    public static function owns(string $path, string $ownerDirectory): bool
    {
        // Uploads are direct children of the server-selected owner directory.
        return MediaPath::isChild($path, $ownerDirectory)
            && ! str_contains(substr($path, strlen($ownerDirectory) + 1), '/');
    }
}
