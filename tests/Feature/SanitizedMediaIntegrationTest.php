<?php

namespace MicroWeb\TiptapEditor\Tests\Feature;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\GenericUser;
use Illuminate\Support\Facades\Storage;
use MicroWeb\TiptapEditor\Services\EditorHtmlSanitizer;
use MicroWeb\TiptapEditor\Services\EditorMediaService;
use MicroWeb\TiptapEditor\Support\TemporaryMediaOwner;
use MicroWeb\TiptapEditor\Tests\TestCase;

final class SanitizedMediaIntegrationTest extends TestCase
{
    private function setupDisk(): void
    {
        config([
            'tiptap-editor.image_upload.disk' => 'public',
            'tiptap-editor.image_upload.temporary_directory' => 'editor/tmp',
            'tiptap-editor.image_upload.permanent_directory' => 'editor/images',
            'tiptap-editor.media_lock.store' => 'array',
            'tiptap-editor.media_lock.seconds' => 300,
        ]);
        Storage::fake('public');
    }

    public function test_sanitize_finalize_and_resanitize_preserve_owned_media(): void
    {
        $this->setupDisk();
        $this->actingAs(new GenericUser(['id' => 721]), 'web');
        $path = TemporaryMediaOwner::directory().'/image.png';
        $disk = Storage::disk('public');
        $disk->put($path, 'fixture');
        $sanitizer = $this->app->make(EditorHtmlSanitizer::class);
        $media = $this->app->make(EditorMediaService::class);
        $clean = $sanitizer->sanitize('<figure data-mw-image="" data-mw-path="'.$path.'" data-align="left" data-width="50"><img src="/storage/'.$path.'" onerror="bad()"><figcaption>Caption</figcaption></figure>');
        $final = $media->finalize($clean, 'editor/images/products/42/description');
        $paths = $media->extractManagedPaths($final);
        self::assertCount(1, $paths);
        self::assertStringStartsWith('editor/images/products/42/description/', $paths[0]);
        $disk->assertExists($paths[0]);
        $disk->assertMissing($path);
        $resanitized = $sanitizer->sanitize($final);
        self::assertSame($paths, $media->extractManagedPaths($resanitized));
        self::assertStringContainsString('<figcaption>Caption</figcaption>', $resanitized);
        self::assertStringNotContainsString('onerror=', $resanitized);
    }

    public function test_sanitizer_does_not_bypass_foreign_owner_validation(): void
    {
        $this->setupDisk();
        $this->actingAs(new GenericUser(['id' => 721]), 'web');
        $path = TemporaryMediaOwner::directory().'/foreign.png';
        $disk = Storage::disk('public');
        $disk->put($path, 'fixture');
        $this->actingAs(new GenericUser(['id' => 722]), 'web');
        $clean = $this->app->make(EditorHtmlSanitizer::class)->sanitize('<figure data-mw-image="" data-mw-path="'.$path.'"><img src="/storage/'.$path.'"></figure>');
        try {
            $this->app->make(EditorMediaService::class)->finalize($clean);
            self::fail('Foreign temporary media was accepted.');
        } catch (AuthorizationException) {
            $disk->assertExists($path);
            self::assertSame([], $disk->allFiles('editor/images'));
        }
    }
}
