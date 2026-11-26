<?php

namespace MicroWeb\TiptapEditor\Tests\Feature;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\GenericUser;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use LogicException;
use MicroWeb\TiptapEditor\Services\EditorMediaService;
use MicroWeb\TiptapEditor\Support\TemporaryMediaOwner;
use MicroWeb\TiptapEditor\Tests\TestCase;

final class TemporaryMediaOwnershipTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config([
            'tiptap-editor.image_upload.enabled' => true,
            'tiptap-editor.image_upload.disk' => 'public',
            'tiptap-editor.image_upload.temporary_directory' => 'editor/tmp',
            'tiptap-editor.image_upload.permanent_directory' => 'editor/images',
        ]);
    }

    private function actor(int $id, string $guard = 'web'): void
    {
        $this->actingAs(new GenericUser(['id' => $id]), $guard);
    }

    private function media(): EditorMediaService
    {
        return $this->app->make(EditorMediaService::class);
    }

    private function figure(string $path): string
    {
        return '<figure data-mw-image data-mw-path="'.$path.'"><img src="/storage/'.$path.'"></figure>';
    }

    public function test_directory_is_stable_for_same_owner_and_distinct_for_other_owner(): void
    {
        $this->actor(901);
        $first = TemporaryMediaOwner::directory();
        self::assertMatchesRegularExpression('~\Aeditor/tmp/owner-[0-9a-f]{64}\z~', $first);
        $this->actor(901);
        self::assertSame($first, TemporaryMediaOwner::directory());
        $this->actor(902);
        self::assertNotSame($first, TemporaryMediaOwner::directory());
    }

    public function test_same_identifier_in_separate_guards_has_separate_ownership(): void
    {
        config(['auth.guards.admin' => config('auth.guards.web')]);
        $this->actor(901, 'web');
        $this->actor(901, 'admin');
        self::assertNotSame(TemporaryMediaOwner::directory('web'), TemporaryMediaOwner::directory('admin'));
        self::assertSame(TemporaryMediaOwner::directory('web'), TemporaryMediaOwner::directory());
    }

    public function test_builtin_upload_is_owner_scoped_and_can_be_finalized_by_owner(): void
    {
        $disk = Storage::fake('public');
        $this->actor(901);
        Gate::define('tiptap-editor.upload', static fn (GenericUser $user): bool => true);
        $file = UploadedFile::fake()->createWithContent('pixel.png', base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGP4/x8AAwAB//wl3FEAAAAASUVORK5CYII=', true
        ));
        $response = $this->post(route('tiptap-editor.media.store'), ['image' => $file], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonStructure(['url', 'path', 'temporary'])->assertJsonPath('temporary', true);
        $path = $response->json('path');
        self::assertIsString($path);
        self::assertTrue(TemporaryMediaOwner::owns($path, TemporaryMediaOwner::directory()));
        self::assertSame('/storage/'.$path, $response->json('url'));
        $disk->assertExists($path);
        $html = $this->media()->finalize($this->figure($path));
        $files = $disk->allFiles('editor/images');
        self::assertCount(1, $files);
        self::assertStringContainsString('data-mw-path="'.$files[0].'"', $html);
        $disk->assertMissing($path);
    }

    public function test_other_owner_is_rejected_before_storage_access(): void
    {
        $this->actor(901);
        $path = TemporaryMediaOwner::directory().'/image.png';
        $this->actor(902);
        Storage::shouldReceive('disk')->never();
        $this->expectException(AuthorizationException::class);
        $this->media()->finalize($this->figure($path));
    }

    public function test_guest_cannot_finalize_a_temporary_reference(): void
    {
        Storage::shouldReceive('disk')->never();
        $this->expectException(AuthorizationException::class);
        $this->media()->finalize($this->figure('editor/tmp/owner-'.str_repeat('a', 64).'/image.png'));
    }

    public function test_legacy_flat_file_is_not_automatically_adopted(): void
    {
        $this->actor(901);
        Storage::shouldReceive('disk')->never();
        $this->expectException(AuthorizationException::class);
        $this->media()->finalize($this->figure('editor/tmp/legacy.png'));
    }

    public function test_mixed_ownership_batch_does_not_move_even_the_owned_file(): void
    {
        $disk = Storage::fake('public');
        $this->actor(901);
        $mine = TemporaryMediaOwner::directory().'/mine.png';
        $this->actor(902);
        $other = TemporaryMediaOwner::directory().'/other.png';
        $disk->put($mine, 'mine');
        $disk->put($other, 'other');
        $this->actor(901);
        try {
            $this->media()->finalize($this->figure($mine).$this->figure($other));
            self::fail('A mixed ownership batch must be rejected.');
        } catch (AuthorizationException) {
            $disk->assertExists([$mine, $other]);
            self::assertSame([], $disk->allFiles('editor/images'));
        }
    }

    public function test_permanent_media_and_plain_html_do_not_require_an_owner(): void
    {
        Storage::shouldReceive('disk')->never();
        $html = '<p>Existing content</p>'.$this->figure('editor/images/existing.png');
        self::assertSame($html, $this->media()->finalize($html));
    }

    public function test_trusted_custom_upload_and_finalize_can_select_same_admin_guard(): void
    {
        $disk = Storage::fake('public');
        config(['auth.guards.admin' => config('auth.guards.web')]);
        $this->actor(901, 'admin');
        $path = TemporaryMediaOwner::directory('admin').'/custom.png';
        $disk->put($path, 'custom');
        $html = $this->media()->finalize($this->figure($path), 'news/42', 'admin');
        $files = $disk->allFiles('news/42');
        self::assertCount(1, $files);
        self::assertSame('custom', $disk->get($files[0]));
        self::assertStringContainsString('src="/storage/'.$files[0].'"', $html);
        $disk->assertMissing($path);
    }

    public function test_missing_application_key_fails_closed(): void
    {
        $this->actor(901);
        config(['app.key' => null]);
        $this->expectException(LogicException::class);
        TemporaryMediaOwner::directory();
    }

    public function test_key_rotation_does_not_grant_access_to_old_scope(): void
    {
        $this->actor(901);
        $path = TemporaryMediaOwner::directory().'/image.png';
        config(['app.key' => 'base64:'.base64_encode(str_repeat('r', 32))]);
        Storage::shouldReceive('disk')->never();
        $this->expectException(AuthorizationException::class);
        $this->media()->finalize($this->figure($path));
    }

    public function test_case_alias_of_temporary_root_is_rejected(): void
    {
        $this->actor(901);
        $path = strtoupper(TemporaryMediaOwner::directory()).'/image.png';
        Storage::shouldReceive('disk')->never();
        $this->expectException(AuthorizationException::class);
        $this->media()->finalize($this->figure($path));
    }

    public function test_nested_file_is_not_a_direct_owned_upload(): void
    {
        $this->actor(901);
        $directory = TemporaryMediaOwner::directory();
        self::assertFalse(TemporaryMediaOwner::owns($directory.'/nested/image.png', $directory));
        self::assertFalse(TemporaryMediaOwner::owns($directory.'-other/image.png', $directory));
        self::assertFalse(TemporaryMediaOwner::owns($directory.'/../image.png', $directory));
        self::assertTrue(TemporaryMediaOwner::owns($directory.'/image.png', $directory));
    }
}
