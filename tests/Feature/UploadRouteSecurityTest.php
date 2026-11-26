<?php

namespace MicroWeb\TiptapEditor\Tests\Feature;

use Illuminate\Auth\GenericUser;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use InvalidArgumentException;
use MicroWeb\TiptapEditor\Support\UploadRouteSettings;
use MicroWeb\TiptapEditor\Tests\TestCase;

final class UploadRouteSecurityTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        config([
            'tiptap-editor.image_upload.enabled' => true,
            'tiptap-editor.image_upload.disk' => 'public',
            'tiptap-editor.image_upload.temporary_directory' => 'editor/tmp',
        ]);
    }

    private function actor(int $id = 201): GenericUser
    {
        return new GenericUser(['id' => $id]);
    }

    private function permit(): void
    {
        Gate::define('tiptap-editor.upload', static fn (GenericUser $user): bool => true);
    }

    private function png(): UploadedFile
    {
        // Real 1x1 PNG bytes; no GD extension is needed to create this fixture.
        return UploadedFile::fake()->createWithContent('pixel.png', base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGP4/x8AAwAB//wl3FEAAAAASUVORK5CYII=',
            true
        ));
    }

    public function test_mandatory_middleware_and_named_limiter_are_registered(): void
    {
        $route = Route::getRoutes()->getByName('tiptap-editor.media.store');
        self::assertNotNull($route);
        foreach (['web', 'auth:web', 'throttle:'.UploadRouteSettings::LIMITER, 'can:tiptap-editor.upload'] as $middleware) {
            self::assertContains($middleware, $route->gatherMiddleware());
        }
        self::assertIsCallable(RateLimiter::limiter(UploadRouteSettings::LIMITER));
    }

    public function test_guest_cannot_upload_even_when_uploads_are_enabled(): void
    {
        $this->post(route('tiptap-editor.media.store'), ['image' => $this->png()], ['Accept' => 'application/json'])
            ->assertUnauthorized();
        self::assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_authenticated_user_without_defined_gate_is_denied(): void
    {
        $this->actingAs($this->actor(), 'web');
        $this->postJson(route('tiptap-editor.media.store'), [])->assertForbidden();
        self::assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_explicit_gate_denial_prevents_upload(): void
    {
        Gate::define('tiptap-editor.upload', static fn (GenericUser $user): bool => false);
        $this->actingAs($this->actor(), 'web');
        $this->post(route('tiptap-editor.media.store'), ['image' => $this->png()], ['Accept' => 'application/json'])
            ->assertForbidden();
        self::assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_authorized_upload_preserves_response_contract(): void
    {
        $this->permit();
        $this->actingAs($this->actor(), 'web');
        $response = $this->post(route('tiptap-editor.media.store'), ['image' => $this->png()], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonStructure(['url', 'path', 'temporary'])->assertJsonPath('temporary', true);
        $path = $response->json('path');
        self::assertIsString($path);
        self::assertStringStartsWith('editor/tmp/', $path);
        self::assertSame('/storage/'.$path, $response->json('url'));
        Storage::disk('public')->assertExists($path);
    }

    public function test_authorized_invalid_upload_still_fails_validation(): void
    {
        $this->permit();
        $this->actingAs($this->actor(), 'web');
        $this->post(route('tiptap-editor.media.store'), [
            'image' => UploadedFile::fake()->createWithContent('bad.txt', 'not an image'),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('image');
        self::assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_rate_limit_is_enforced_and_scoped_to_user(): void
    {
        config(['tiptap-editor.upload_route.attempts_per_minute' => 2]);
        $this->permit();
        $this->actingAs($this->actor(202), 'web');
        $url = route('tiptap-editor.media.store');
        $this->postJson($url, [])->assertUnprocessable();
        $this->postJson($url, [])->assertUnprocessable();
        $this->postJson($url, [])->assertTooManyRequests();
        $this->actingAs($this->actor(203), 'web');
        $this->postJson($url, [])->assertUnprocessable();
        self::assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_old_published_config_without_new_keys_uses_secure_defaults(): void
    {
        $old = config('tiptap-editor');
        unset($old['upload_route']);
        config(['tiptap-editor' => $old]);
        self::assertSame(['web', 'auth:web', 'throttle:'.UploadRouteSettings::LIMITER, 'can:tiptap-editor.upload'], UploadRouteSettings::middleware());
        self::assertSame(20, UploadRouteSettings::attemptsPerMinute());
    }

    public function test_custom_guard_ability_and_additive_middleware_are_resolved(): void
    {
        config(['tiptap-editor.upload_route' => [
            'guard' => 'admin', 'ability' => 'products.edit',
            'additional_middleware' => ['verified', 'web'], 'attempts_per_minute' => 5,
        ]]);
        self::assertSame(['web', 'auth:admin', 'throttle:'.UploadRouteSettings::LIMITER, 'can:products.edit', 'verified'], UploadRouteSettings::middleware());
        self::assertSame(5, UploadRouteSettings::attemptsPerMinute());
    }

    public function test_blank_permission_is_rejected_instead_of_removing_gate(): void
    {
        config(['tiptap-editor.upload_route.ability' => '']);
        $this->expectException(InvalidArgumentException::class);
        UploadRouteSettings::middleware();
    }

    public function test_invalid_rate_limit_is_rejected(): void
    {
        config(['tiptap-editor.upload_route.attempts_per_minute' => 0]);
        $this->expectException(InvalidArgumentException::class);
        UploadRouteSettings::attemptsPerMinute();
    }

    public function test_unrelated_host_route_does_not_inherit_package_middleware(): void
    {
        Route::post('/host-test/custom-media', static fn () => response()->json(['host' => true]))->middleware('web');
        $this->postJson('/host-test/custom-media', [])->assertOk()->assertJsonPath('host', true);
    }
}
