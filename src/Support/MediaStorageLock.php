<?php

namespace MicroWeb\TiptapEditor\Support;

use Closure;
use Illuminate\Cache\ArrayStore;
use Illuminate\Cache\NullStore;
use Illuminate\Contracts\Cache\LockProvider;
use Illuminate\Support\Facades\Cache;
use InvalidArgumentException;
use MicroWeb\TiptapEditor\Exceptions\MediaStorageBusyException;
use RuntimeException;
use Throwable;

/** Cooperative, leased mutex for all editor mutations on one configured disk. */
final class MediaStorageLock
{
    public static function key(string $diskName): string
    {
        if ($diskName === '' || strlen($diskName) > 255 || trim($diskName) !== $diskName) {
            throw new InvalidArgumentException('Invalid editor media disk name.');
        }

        return 'microweb:tiptap:media:v1:'.hash('sha256', strtolower($diskName));
    }

    /** @template T @param Closure(): T $operation @return T */
    public static function run(string $diskName, Closure $operation): mixed
    {
        $key = self::key($diskName);
        $storeName = config('tiptap-editor.media_lock.store');
        $seconds = config('tiptap-editor.media_lock.seconds', 300);
        if (($storeName !== null && (! is_string($storeName) || trim($storeName) === ''))
            || ! is_int($seconds) || $seconds < 30 || $seconds > 3600) {
            throw new InvalidArgumentException('Invalid editor media lock configuration.');
        }

        $store = Cache::store($storeName)->getStore();
        if (! $store instanceof LockProvider || $store instanceof NullStore
            || ($store instanceof ArrayStore && ! app()->runningUnitTests())) {
            throw new RuntimeException('Editor media requires a shared atomic-lock-capable cache store.');
        }

        $lock = $store->lock($key, $seconds);
        if (! $lock->get()) {
            throw new MediaStorageBusyException('Editor media storage is busy. Retry shortly.');
        }

        try {
            return $operation();
        } finally {
            // Never force-release a lock that may now belong to another worker.
            // Do not replace an original operation failure or report a committed
            // move as failed solely because lock release failed.
            try {
                if (! $lock->release()) {
                    report(new RuntimeException('Editor media lock ownership was lost before release.'));
                }
            } catch (Throwable $failure) {
                report($failure);
            }
        }
    }
}
