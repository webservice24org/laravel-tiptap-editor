<?php

namespace MicroWeb\TiptapEditor\Tests\Feature;

use Illuminate\Auth\GenericUser;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use InvalidArgumentException;
use MicroWeb\TiptapEditor\Exceptions\MediaStorageBusyException;
use MicroWeb\TiptapEditor\Services\EditorMediaService;
use MicroWeb\TiptapEditor\Support\MediaStorageLock;
use MicroWeb\TiptapEditor\Support\TemporaryMediaOwner;
use MicroWeb\TiptapEditor\Tests\TestCase;
use Mockery;
use RuntimeException;

final class TemporaryMediaCleanupTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config([
            'tiptap-editor.image_upload.disk' => 'public',
            'tiptap-editor.image_upload.temporary_directory' => 'editor/tmp',
            'tiptap-editor.image_upload.permanent_directory' => 'editor/images',
            'tiptap-editor.image_upload.enabled' => true,
            'tiptap-editor.media_lock.store' => 'array',
            'tiptap-editor.media_lock.seconds' => 300,
        ]);
    }

    private function media(): EditorMediaService
    {
        return $this->app->make(EditorMediaService::class);
    }

    private function oldFile(FilesystemAdapter $disk, string $path): void
    {
        $disk->put($path, 'fixture');
        self::assertTrue(touch($disk->path($path), now()->subHours(48)->getTimestamp()));
        clearstatcache(true, $disk->path($path));
    }

    private function heldLock(): \Illuminate\Contracts\Cache\Lock
    {
        $lock = Cache::store('array')->getStore()->lock(MediaStorageLock::key('public'), 300);
        self::assertTrue($lock->get());
        return $lock;
    }

    public function test_only_expired_flat_and_owner_scoped_files_are_removed(): void
    {
        $disk = Storage::fake('public');
        $owner = 'editor/tmp/owner-'.str_repeat('a', 64);
        foreach (['editor/tmp/legacy.png', $owner.'/old.png', 'editor/tmp/unknown/old.png', $owner.'/nested/old.png', 'editor/images/old.png'] as $path) {
            $this->oldFile($disk, $path);
        }
        $disk->put($owner.'/fresh.png', 'fresh');
        self::assertSame(2, $this->media()->cleanupTemporaryMedia(24));
        $disk->assertMissing(['editor/tmp/legacy.png', $owner.'/old.png']);
        $disk->assertExists(['editor/tmp/unknown/old.png', $owner.'/nested/old.png', 'editor/images/old.png', $owner.'/fresh.png']);
    }

    public function test_cutoff_is_inclusive_and_fresh_file_is_preserved(): void
    {
        $this->freezeTime(function ($time): void {
            $disk = Storage::fake('public');
            foreach (['edge.png' => 0, 'fresh.png' => 1] as $file => $offset) {
                $path = 'editor/tmp/'.$file;
                $disk->put($path, 'fixture');
                self::assertTrue(touch($disk->path($path), $time->copy()->subHours(24)->getTimestamp() + $offset));
                clearstatcache(true, $disk->path($path));
            }
            self::assertSame(1, $this->media()->cleanupTemporaryMedia(24));
            $disk->assertMissing('editor/tmp/edge.png');
            $disk->assertExists('editor/tmp/fresh.png');
        });
    }

    public function test_busy_cleanup_leaves_file_and_retries_on_later_run(): void
    {
        $disk = Storage::fake('public');
        $this->oldFile($disk, 'editor/tmp/old.png');
        $lock = $this->heldLock();
        try {
            self::assertSame(0, $this->media()->cleanupTemporaryMedia(24));
            $disk->assertExists('editor/tmp/old.png');
        } finally {
            $lock->release();
        }
        self::assertSame(1, $this->media()->cleanupTemporaryMedia(24));
        $disk->assertMissing('editor/tmp/old.png');
    }

    public function test_busy_finalization_fails_before_storage_access(): void
    {
        $this->actingAs(new GenericUser(['id' => 923]), 'web');
        $path = TemporaryMediaOwner::directory().'/image.png';
        $lock = $this->heldLock();
        Storage::shouldReceive('disk')->never();
        try {
            $this->expectException(MediaStorageBusyException::class);
            $this->media()->finalize('<figure data-mw-image data-mw-path="'.$path.'"><img src="/storage/'.$path.'"></figure>');
        } finally {
            $lock->release();
        }
    }

    public function test_busy_builtin_upload_returns_retryable_response_without_writing(): void
    {
        $disk = Storage::fake('public');
        $this->actingAs(new GenericUser(['id' => 924]), 'web');
        Gate::define('tiptap-editor.upload', static fn (GenericUser $user): bool => true);
        $file = UploadedFile::fake()->createWithContent('pixel.png', base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGP4/x8AAwAB//wl3FEAAAAASUVORK5CYII=', true
        ));
        $lock = $this->heldLock();
        try {
            $this->post(route('tiptap-editor.media.store'), ['image' => $file], ['Accept' => 'application/json'])
                ->assertStatus(503)->assertHeader('Retry-After', '1');
            self::assertSame([], $disk->allFiles());
        } finally {
            $lock->release();
        }
    }

    public function test_lock_is_released_after_callback_exception(): void
    {
        $original = new RuntimeException('fixture failure');
        try {
            MediaStorageLock::run('public', static function () use ($original): never { throw $original; });
            self::fail('Expected original exception.');
        } catch (RuntimeException $failure) {
            self::assertSame($original, $failure);
        }
        self::assertSame('ok', MediaStorageLock::run('public', static fn (): string => 'ok'));
    }

    public function test_disk_key_is_case_alias_safe_and_different_disks_do_not_block(): void
    {
        self::assertSame(MediaStorageLock::key('public'), MediaStorageLock::key('PUBLIC'));
        self::assertNotSame(MediaStorageLock::key('public'), MediaStorageLock::key('other'));
        $lock = $this->heldLock();
        try {
            self::assertSame(1, MediaStorageLock::run('other', static fn (): int => 1));
            $this->expectException(MediaStorageBusyException::class);
            MediaStorageLock::run('PUBLIC', static fn (): int => 1);
        } finally {
            $lock->release();
        }
    }

    public function test_null_cache_is_rejected_before_callback(): void
    {
        config(['cache.stores.editor_null' => ['driver' => 'null'], 'tiptap-editor.media_lock.store' => 'editor_null']);
        $this->expectException(RuntimeException::class);
        MediaStorageLock::run('public', static function (): never { self::fail('Unsafe cache allowed mutation.'); });
    }

    public function test_invalid_lock_lease_is_rejected_before_callback(): void
    {
        config(['tiptap-editor.media_lock.seconds' => 0]);
        $this->expectException(InvalidArgumentException::class);
        MediaStorageLock::run('public', static function (): never { self::fail('Invalid lease allowed mutation.'); });
    }

    public function test_listing_duplicates_missing_and_directory_paths_are_not_deleted(): void
    {
        $disk = Mockery::mock(FilesystemAdapter::class);
        $disk->shouldReceive('allFiles')->once()->with('editor/tmp')->andReturn(['editor/tmp/old.png', 'editor/tmp/old.png', 'editor/tmp/missing.png', 'editor/tmp/directory']);
        $disk->shouldReceive('fileExists')->once()->with('editor/tmp/old.png')->andReturn(true);
        $disk->shouldReceive('fileExists')->once()->with('editor/tmp/missing.png')->andReturn(false);
        $disk->shouldReceive('fileExists')->once()->with('editor/tmp/directory')->andReturn(false);
        $disk->shouldReceive('lastModified')->once()->with('editor/tmp/old.png')->andReturn(1);
        $disk->shouldReceive('delete')->once()->with('editor/tmp/old.png')->andReturn(true);
        $disk->shouldReceive('exists')->once()->with('editor/tmp/old.png')->andReturn(false);
        Storage::shouldReceive('disk')->with('public')->once()->andReturn($disk);
        self::assertSame(1, $this->media()->cleanupTemporaryMedia(24));
    }

    public function test_metadata_and_delete_are_performed_under_mutation_lock(): void
    {
        $disk = Mockery::mock(FilesystemAdapter::class);
        $path = 'editor/tmp/old.png';
        $disk->shouldReceive('allFiles')->once()->andReturn([$path]);
        $disk->shouldReceive('fileExists')->once()->with($path)->andReturn(true);
        $disk->shouldReceive('lastModified')->once()->with($path)->andReturnUsing(function (): int {
            $competing = Cache::store('array')->getStore()->lock(MediaStorageLock::key('public'), 300);
            self::assertFalse($competing->get());
            return 1;
        });
        $disk->shouldReceive('delete')->once()->with($path)->andReturnUsing(function (): bool {
            $competing = Cache::store('array')->getStore()->lock(MediaStorageLock::key('public'), 300);
            self::assertFalse($competing->get());
            return true;
        });
        $disk->shouldReceive('exists')->once()->with($path)->andReturn(false);
        Storage::shouldReceive('disk')->with('public')->once()->andReturn($disk);
        self::assertSame(1, $this->media()->cleanupTemporaryMedia(24));
        self::assertTrue(MediaStorageLock::run('public', static fn (): bool => true));
    }

    public function test_failed_or_unverified_deletion_does_not_increment_count(): void
    {
        $disk = Mockery::mock(FilesystemAdapter::class);
        $disk->shouldReceive('allFiles')->once()->andReturn(['editor/tmp/false.png', 'editor/tmp/still.png', 'editor/tmp/ok.png']);
        $disk->shouldReceive('fileExists')->times(3)->andReturn(true);
        $disk->shouldReceive('lastModified')->times(3)->andReturn(1);
        $disk->shouldReceive('delete')->once()->with('editor/tmp/false.png')->andReturn(false);
        $disk->shouldReceive('delete')->once()->with('editor/tmp/still.png')->andReturn(true);
        $disk->shouldReceive('delete')->once()->with('editor/tmp/ok.png')->andReturn(true);
        $disk->shouldReceive('exists')->once()->with('editor/tmp/still.png')->andReturn(true);
        $disk->shouldReceive('exists')->once()->with('editor/tmp/ok.png')->andReturn(false);
        Storage::shouldReceive('disk')->with('public')->once()->andReturn($disk);
        self::assertSame(1, $this->media()->cleanupTemporaryMedia(24));
    }

    public function test_invalid_lifetime_fails_before_disk_access(): void
    {
        Storage::shouldReceive('disk')->never();
        $this->expectException(InvalidArgumentException::class);
        $this->media()->cleanupTemporaryMedia(0);
    }

    public function test_command_rejects_invalid_hours_without_disk_access(): void
    {
        Storage::shouldReceive('disk')->never();
        $this->artisan('tiptap-editor:cleanup', ['--hours' => 'not-a-number'])
            ->expectsOutput('The --hours option must be an integer from 1 to 87600.')
            ->assertExitCode(1);
    }
}
