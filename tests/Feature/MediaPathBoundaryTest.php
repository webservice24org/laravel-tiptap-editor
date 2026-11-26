<?php

namespace MicroWeb\TiptapEditor\Tests\Feature;

use Illuminate\Auth\GenericUser;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use InvalidArgumentException;
use MicroWeb\TiptapEditor\Services\EditorMediaService;
use MicroWeb\TiptapEditor\Support\TemporaryMediaOwner;
use MicroWeb\TiptapEditor\Tests\TestCase;
use Mockery;

final class MediaPathBoundaryTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config([
            'tiptap-editor.image_upload.disk' => 'public',
            'tiptap-editor.image_upload.temporary_directory' => 'editor/tmp',
            'tiptap-editor.image_upload.permanent_directory' => 'editor/images',
        ]);
    }

    private function media(): EditorMediaService
    {
        return $this->app->make(EditorMediaService::class);
    }

    private function figure(string $path): string
    {
        return '<figure data-mw-image data-mw-path="'.$path.'"><img src="/storage/'.$path.'"></figure>';
    }

    public function test_finalize_rejects_noncanonical_and_outside_paths_before_storage_lookup(): void
    {
        $disk = Mockery::mock(Filesystem::class);
        $disk->shouldNotReceive('exists');
        $disk->shouldNotReceive('move');
        Storage::shouldReceive('disk')->with('public')->andReturn($disk);
        $html = '';
        foreach (['/editor/tmp/a.png', 'editor/tmp/../secret.png', 'editor/tmp/&#46;&#46;/secret.png', 'editor/tmp/%2e%2e/secret.png', 'editor/tmp', 'editor/tmp-other/a.png', 'editor/images/a.png'] as $path) {
            $html .= $this->figure($path);
        }
        self::assertSame($html, $this->media()->finalize($html));
    }

    public function test_valid_temporary_path_moves_to_existing_host_custom_destination(): void
    {
        $disk = Storage::fake('public');
        $this->actingAs(new GenericUser(['id' => 802]), 'web');
        $old = TemporaryMediaOwner::directory('web').'/create-description.jpg';
        $disk->put($old, 'fixture');
        $disk->put('editor/images/existing.jpg', 'keep');
        $html = $this->media()->finalize($this->figure($old), 'news/42');
        $files = $disk->allFiles('news/42');
        self::assertCount(1, $files);
        self::assertStringContainsString('data-mw-path="'.$files[0].'"', $html);
        self::assertStringContainsString('src="/storage/'.$files[0].'"', $html);
        $disk->assertMissing($old);
        $disk->assertExists('editor/images/existing.jpg');
        self::assertSame('fixture', $disk->get($files[0]));
    }

    public function test_invalid_custom_destination_is_rejected_before_disk_access(): void
    {
        Storage::shouldReceive('disk')->never();
        $this->expectException(InvalidArgumentException::class);
        $this->media()->finalize($this->figure('editor/tmp/a.png'), '../outside');
    }

    public function test_overlapping_custom_destination_is_rejected_before_disk_access(): void
    {
        Storage::shouldReceive('disk')->never();
        $this->expectException(InvalidArgumentException::class);
        $this->media()->finalize($this->figure('editor/tmp/a.png'), 'EDITOR');
    }

    public function test_cleanup_rejects_overlapping_configuration_before_listing(): void
    {
        config(['tiptap-editor.image_upload.permanent_directory' => 'editor/tmp/images']);
        Storage::shouldReceive('disk')->never();
        $this->expectException(InvalidArgumentException::class);
        $this->media()->cleanupTemporaryMedia();
    }

    public function test_cleanup_checks_every_listed_path_before_metadata_or_deletion(): void
    {
        $disk = Mockery::mock(FilesystemAdapter::class);
        $disk->shouldReceive('allFiles')->once()->with('editor/tmp')->andReturn([
            'editor/tmp/old.png', 'editor/tmp/../outside.png', 'editor/tmp', '/editor/tmp/a.png', 'editor/tmp-other/old.png', 'editor/images/old.png',
        ]);
        $disk->shouldReceive('fileExists')->once()->with('editor/tmp/old.png')->andReturn(true);
        $disk->shouldReceive('lastModified')->once()->with('editor/tmp/old.png')->andReturn(1);
        $disk->shouldReceive('delete')->once()->with('editor/tmp/old.png')->andReturn(true);
        $disk->shouldReceive('exists')->once()->with('editor/tmp/old.png')->andReturn(false);
        Storage::shouldReceive('disk')->with('public')->andReturn($disk);
        self::assertSame(1, $this->media()->cleanupTemporaryMedia(24));
    }

    public function test_managed_path_extraction_decodes_once_and_deduplicates_canonical_paths(): void
    {
        $html = $this->figure('editor/tmp/a.png').$this->figure('editor/tmp/&#97;.png')
            .$this->figure('editor/tmp/&#46;&#46;/a.png').$this->figure('/editor/tmp/a.png')
            .$this->figure('editor/images/existing.png');
        self::assertSame(['editor/tmp/a.png', 'editor/images/existing.png'], $this->media()->extractManagedPaths($html));
    }

    public function test_builtin_upload_invalid_directory_is_rejected_before_storage(): void
    {
        config([
            'tiptap-editor.image_upload.enabled' => true,
            'tiptap-editor.image_upload.temporary_directory' => '../outside',
        ]);
        Gate::define('tiptap-editor.upload', static fn (GenericUser $user): bool => true);
        $this->actingAs(new GenericUser(['id' => 801]), 'web');
        Storage::shouldReceive('disk')->never();
        $this->withoutExceptionHandling();
        $this->expectException(InvalidArgumentException::class);
        $file = UploadedFile::fake()->createWithContent('pixel.png', base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGP4/x8AAwAB//wl3FEAAAAASUVORK5CYII=', true
        ));
        $this->post(route('tiptap-editor.media.store'), ['image' => $file], ['Accept' => 'application/json']);
    }
}
