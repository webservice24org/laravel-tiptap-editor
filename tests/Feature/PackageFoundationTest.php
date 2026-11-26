<?php

namespace MicroWeb\TiptapEditor\Tests\Feature;

use Illuminate\Auth\GenericUser;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\ServiceProvider;
use MicroWeb\TiptapEditor\Http\Controllers\MediaUploadController;
use MicroWeb\TiptapEditor\Services\EditorHtmlSanitizer;
use MicroWeb\TiptapEditor\Services\EditorMediaService;
use MicroWeb\TiptapEditor\Tests\TestCase;
use MicroWeb\TiptapEditor\TiptapEditorServiceProvider;

final class PackageFoundationTest extends TestCase
{
    public function test_package_services_are_registered_as_singletons(): void
    {
        $sanitizer = $this->app->make(EditorHtmlSanitizer::class);
        $media = $this->app->make(EditorMediaService::class);

        self::assertInstanceOf(EditorHtmlSanitizer::class, $sanitizer);
        self::assertInstanceOf(EditorMediaService::class, $media);
        self::assertSame($sanitizer, $this->app->make(EditorHtmlSanitizer::class));
        self::assertSame($media, $this->app->make(EditorMediaService::class));
    }

    public function test_package_configuration_is_merged(): void
    {
        $upload = config('tiptap-editor.image_upload');

        self::assertIsArray($upload);
        foreach (['enabled', 'disk', 'temporary_directory', 'permanent_directory', 'temporary_lifetime', 'max_size', 'allowed_mimes'] as $key) {
            self::assertArrayHasKey($key, $upload);
        }
        self::assertFalse($upload['enabled']);
        self::assertIsArray($upload['allowed_mimes']);
        self::assertFalse(config('tiptap-editor.cleanup.schedule'));
    }

    public function test_configuration_publish_tag_is_registered(): void
    {
        $paths = ServiceProvider::pathsToPublish(TiptapEditorServiceProvider::class, 'tiptap-editor-config');

        self::assertContains(config_path('tiptap-editor.php'), array_values($paths));
    }

    public function test_named_upload_route_is_registered(): void
    {
        $route = Route::getRoutes()->getByName('tiptap-editor.media.store');

        self::assertNotNull($route);
        self::assertSame('tiptap-editor/media', $route->uri());
        self::assertContains('POST', $route->methods());
        self::assertSame(MediaUploadController::class.'@__invoke', $route->getAction('uses'));
        self::assertContains('web', $route->gatherMiddleware());
    }

    public function test_disabled_upload_returns_forbidden(): void
    {
        Storage::fake('public');
        config(['tiptap-editor.image_upload.enabled' => false, 'tiptap-editor.image_upload.disk' => 'public']);

        Gate::define('tiptap-editor.upload', static fn (GenericUser $user): bool => true);
        $this->actingAs(new GenericUser(['id' => 101]), 'web');
        $this->postJson(route('tiptap-editor.media.store'), [])->assertForbidden();
        self::assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_cleanup_command_runs_on_an_isolated_empty_disk(): void
    {
        Storage::fake('public');
        config([
            'tiptap-editor.image_upload.disk' => 'public',
            'tiptap-editor.image_upload.temporary_directory' => 'editor/tmp',
        ]);

        $this->artisan('tiptap-editor:cleanup', ['--hours' => 24])
            ->expectsOutput('Deleted 0 temporary media file(s).')
            ->assertExitCode(0);
    }
}
