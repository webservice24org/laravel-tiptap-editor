<?php

namespace MicroWeb\TiptapEditor\Tests\Feature;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\GenericUser;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use InvalidArgumentException;
use MicroWeb\TiptapEditor\Exceptions\MediaStorageBusyException;
use MicroWeb\TiptapEditor\Services\EditorHtmlSanitizer;
use MicroWeb\TiptapEditor\Services\EditorMediaService;
use MicroWeb\TiptapEditor\Support\MediaStorageLock;
use MicroWeb\TiptapEditor\Support\TemporaryMediaOwner;
use MicroWeb\TiptapEditor\Tests\TestCase;
use Ramsey\Uuid\Uuid;
use RuntimeException;

/** Cross-component acceptance tests. No real host data or external storage. */
final class EditorSecurityJourneyTest extends TestCase
{
    private const DESTINATION = 'editor/images/products/42/description';

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'tiptap-editor.image_upload.enabled' => true,
            'tiptap-editor.image_upload.disk' => 'public',
            'tiptap-editor.image_upload.temporary_directory' => 'editor/tmp',
            'tiptap-editor.image_upload.permanent_directory' => 'editor/images',
            'tiptap-editor.image_upload.max_size' => 5120,
            'tiptap-editor.image_upload.max_width' => 8192,
            'tiptap-editor.image_upload.max_height' => 8192,
            'tiptap-editor.image_upload.max_pixels' => 40000000,
            'tiptap-editor.image_upload.allowed_mimes' => ['image/png'],
            'tiptap-editor.media_lock.store' => 'array',
            'tiptap-editor.media_lock.seconds' => 300,
        ]);
        Storage::fake('public');
        Gate::define('tiptap-editor.upload', static fn (GenericUser $user): bool => true);
        $this->actor(2101);
    }

    private function actor(int $id): void
    {
        $this->actingAs(new GenericUser(['id' => $id]), 'web');
    }

    private function png(bool $second = false): string
    {
        return base64_decode($second
            ? 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAAFElEQVR4nGPUSNnCwMDAxMDAgKAAF4gBRrRYoVYAAAAASUVORK5CYII='
            : 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGP4/x8AAwAB//wl3FEAAAAASUVORK5CYII=', true);
    }

    private function requestUpload(string $bytes): TestResponse
    {
        return $this->post(route('tiptap-editor.media.store'), [
            'image' => UploadedFile::fake()->createWithContent('client-name.jpg', $bytes),
        ], ['Accept' => 'application/json']);
    }

    /** @return array{path:string,url:string,temporary:bool} */
    private function upload(bool $second = false): array
    {
        $response = $this->requestUpload($this->png($second))->assertOk()
            ->assertJsonStructure(['path', 'url', 'temporary'])->assertJsonPath('temporary', true);
        $data = $response->json();
        self::assertIsString($data['path']);
        self::assertIsString($data['url']);
        self::assertTrue(TemporaryMediaOwner::owns($data['path'], TemporaryMediaOwner::directory()));
        self::assertStringEndsWith('.png', $data['path']);
        self::assertSame($this->png($second), $this->disk()->get($data['path']));

        return $data;
    }

    private function disk(): FilesystemAdapter
    {
        return Storage::disk(config('tiptap-editor.image_upload.disk'));
    }

    private function media(): EditorMediaService
    {
        return $this->app->make(EditorMediaService::class);
    }

    private function clean(string $html): string
    {
        return $this->app->make(EditorHtmlSanitizer::class)->sanitize($html);
    }

    private function figure(array $upload, string $caption = 'Caption'): string
    {
        return '<figure data-mw-image="" data-mw-path="'.htmlspecialchars($upload['path'], ENT_QUOTES).'" data-align="left" data-width="50">'
            .'<img src="'.htmlspecialchars($upload['url'], ENT_QUOTES).'" alt="Example" onerror="bad()">'
            .'<figcaption>'.htmlspecialchars($caption, ENT_QUOTES).'</figcaption></figure>';
    }

    private function age(string $path): void
    {
        $absolute = $this->disk()->path($path);
        self::assertTrue(touch($absolute, now()->subHours(48)->getTimestamp()));
        clearstatcache(true, $absolute);
    }

    public function test_real_upload_to_sanitized_multi_image_finalization_and_idempotent_resave(): void
    {
        $first = $this->upload();
        $second = $this->upload(true);
        self::assertNotSame($first['path'], $second['path']);
        $raw = '<p>বাংলা <strong>Text</strong></p><script>bad()</script><a href="javascript:bad()">link</a>'
            .$this->figure($first, 'প্রথম ছবি').$this->figure($second).$this->figure($first)
            .'<img src="https://example.org/external.png" alt="External">';
        $clean = $this->clean($raw);
        $final = $this->clean($this->media()->finalize($clean, self::DESTINATION));
        $paths = $this->media()->extractManagedPaths($final);
        self::assertCount(2, $paths);
        foreach ($paths as $index => $path) {
            self::assertStringStartsWith(self::DESTINATION.'/', $path);
            self::assertStringContainsString('src="/storage/'.$path.'"', $final);
            self::assertSame($this->png($index === 1), $this->disk()->get($path));
        }
        self::assertSame(2, substr_count($final, 'data-mw-path="'.$paths[0].'"'));
        self::assertStringContainsString('প্রথম ছবি', $final);
        self::assertStringContainsString('বাংলা', $final);
        self::assertStringContainsString('https://example.org/external.png', $final);
        self::assertStringNotContainsString('<script', $final);
        self::assertStringNotContainsString('onerror=', $final);
        self::assertStringNotContainsString('javascript:', $final);
        $this->disk()->assertMissing([$first['path'], $second['path']]);
        self::assertSame($final, $this->media()->finalize($final, self::DESTINATION));
        self::assertCount(2, $this->disk()->allFiles(self::DESTINATION));
    }

    public function test_mixed_real_upload_owners_rejected_before_any_file_moves(): void
    {
        $foreign = $this->upload();
        $this->actor(2102);
        $own = $this->upload(true);
        $html = $this->clean($this->figure($own).$this->figure($foreign));
        try {
            $this->media()->finalize($html, self::DESTINATION);
            self::fail('Foreign upload was accepted.');
        } catch (AuthorizationException) {
            self::assertSame($this->png(), $this->disk()->get($foreign['path']));
            self::assertSame($this->png(true), $this->disk()->get($own['path']));
            self::assertSame([], $this->disk()->allFiles('editor/images'));
        }
        $final = $this->media()->finalize($this->clean($this->figure($own)), self::DESTINATION);
        self::assertCount(1, $this->media()->extractManagedPaths($final));
        $this->disk()->assertExists($foreign['path']);
        $this->disk()->assertMissing($own['path']);
    }

    public function test_sanitized_mismatched_reference_rejected_and_corrected_batch_can_retry(): void
    {
        $first = $this->upload();
        $second = $this->upload(true);
        $wrong = $second;
        $wrong['url'] = $first['url'];
        try {
            $this->media()->finalize($this->clean($this->figure($first).$this->figure($wrong)), self::DESTINATION);
            self::fail('Mismatched URL was accepted.');
        } catch (InvalidArgumentException $failure) {
            self::assertStringContainsString('does not match', $failure->getMessage());
            $this->disk()->assertExists([$first['path'], $second['path']]);
            self::assertSame([], $this->disk()->allFiles('editor/images'));
        }
        $final = $this->media()->finalize($this->clean($this->figure($first).$this->figure($second)), self::DESTINATION);
        self::assertCount(2, $this->media()->extractManagedPaths($final));
    }

    public function test_cleanup_command_preserves_finalized_and_fresh_media_bytes(): void
    {
        $saved = $this->upload();
        $abandoned = $this->upload(true);
        $fresh = $this->upload();
        $final = $this->media()->finalize($this->clean($this->figure($saved)), self::DESTINATION);
        [$permanent] = $this->media()->extractManagedPaths($final);
        $this->age($permanent);
        $this->age($abandoned['path']);
        $unknown = 'editor/tmp/unknown/keep.png';
        $this->disk()->put($unknown, $this->png());
        $this->age($unknown);
        $this->artisan('tiptap-editor:cleanup', ['--hours' => 24])
            ->expectsOutput('Deleted 1 temporary media file(s).')->assertExitCode(0);
        $this->disk()->assertMissing([$saved['path'], $abandoned['path']]);
        self::assertSame($this->png(), $this->disk()->get($permanent));
        self::assertSame($this->png(), $this->disk()->get($fresh['path']));
        self::assertSame($this->png(), $this->disk()->get($unknown));
    }

    public function test_cleanup_expired_reference_blocks_whole_real_upload_batch(): void
    {
        $fresh = $this->upload();
        $expired = $this->upload(true);
        $html = $this->clean($this->figure($fresh).$this->figure($expired));
        $this->age($expired['path']);
        self::assertSame(1, $this->media()->cleanupTemporaryMedia(24));
        try {
            $this->media()->finalize($html, self::DESTINATION);
            self::fail('Expired reference was silently accepted.');
        } catch (RuntimeException $failure) {
            self::assertStringContainsString('missing', $failure->getMessage());
            self::assertSame($this->png(), $this->disk()->get($fresh['path']));
            $this->disk()->assertMissing($expired['path']);
            self::assertSame([], $this->disk()->allFiles('editor/images'));
        }
    }

    public function test_independent_file_cache_stores_coordinate_upload_finalize_and_cleanup(): void
    {
        // Both store instances point to a disposable cache directory inside the fake disk.
        $root = $this->disk()->path('qa-cache');
        $settings = ['driver' => 'file', 'path' => $root, 'lock_path' => $root];
        config(['cache.stores.editor_qa_a' => $settings, 'cache.stores.editor_qa_b' => $settings,
            'tiptap-editor.media_lock.store' => 'editor_qa_a']);
        self::assertNotSame(Cache::store('editor_qa_a')->getStore(), Cache::store('editor_qa_b')->getStore());
        $fresh = $this->upload();
        $expired = $this->upload(true);
        $this->age($expired['path']);
        $html = $this->clean($this->figure($fresh));
        $held = Cache::store('editor_qa_b')->getStore()->lock(MediaStorageLock::key('public'), 300);
        self::assertTrue($held->get());
        try {
            $this->requestUpload($this->png())->assertStatus(503)->assertHeader('Retry-After', '1');
            try {
                $this->media()->finalize($html, self::DESTINATION);
                self::fail('Finalization bypassed file-cache lock.');
            } catch (MediaStorageBusyException) {
                self::assertSame([], $this->disk()->allFiles('editor/images'));
            }
            self::assertSame(0, $this->media()->cleanupTemporaryMedia(24));
            self::assertCount(2, $this->disk()->allFiles('editor/tmp'));
            $this->disk()->assertExists([$fresh['path'], $expired['path']]);
        } finally {
            $held->release();
        }
        $final = $this->media()->finalize($html, self::DESTINATION);
        [$permanent] = $this->media()->extractManagedPaths($final);
        self::assertSame($this->png(), $this->disk()->get($permanent));
        self::assertSame(1, $this->media()->cleanupTemporaryMedia(24));
        $this->disk()->assertMissing([$fresh['path'], $expired['path']]);
        $this->upload(); // A valid upload can also acquire the released lock.
    }

    public function test_rejected_uploads_do_not_disturb_existing_valid_upload(): void
    {
        $valid = $this->upload();
        $this->requestUpload('<html>not an image</html>')->assertUnprocessable()->assertJsonValidationErrors('image');
        Gate::define('tiptap-editor.upload', static fn (GenericUser $user): bool => false);
        $this->requestUpload($this->png(true))->assertForbidden();
        self::assertSame([$valid['path']], $this->disk()->allFiles('editor/tmp'));
        self::assertSame($this->png(), $this->disk()->get($valid['path']));
        $final = $this->media()->finalize($this->clean($this->figure($valid)), self::DESTINATION);
        [$permanent] = $this->media()->extractManagedPaths($final);
        self::assertSame($this->png(), $this->disk()->get($permanent));
    }

    public function test_real_upload_collision_preserves_both_files_and_allows_retry(): void
    {
        $upload = $this->upload();
        $uuid = 'e7b6efc0-8cec-4af5-a87d-45850ee915a3';
        $collision = self::DESTINATION.'/'.$uuid.'.png';
        $this->disk()->put($collision, $this->png(true));
        $html = $this->clean($this->figure($upload));
        Str::createUuidsUsing(static fn () => Uuid::fromString($uuid));
        try {
            try {
                $this->media()->finalize($html, self::DESTINATION);
                self::fail('Destination collision accepted.');
            } catch (RuntimeException $failure) {
                self::assertStringContainsString('already exists', $failure->getMessage());
                self::assertSame($this->png(), $this->disk()->get($upload['path']));
                self::assertSame($this->png(true), $this->disk()->get($collision));
            }
        } finally {
            Str::createUuidsNormally();
        }
        $final = $this->media()->finalize($html, self::DESTINATION);
        [$permanent] = $this->media()->extractManagedPaths($final);
        self::assertNotSame($collision, $permanent);
        self::assertSame($this->png(), $this->disk()->get($permanent));
        self::assertSame($this->png(true), $this->disk()->get($collision));
        $this->disk()->assertMissing($upload['path']);
    }
}
