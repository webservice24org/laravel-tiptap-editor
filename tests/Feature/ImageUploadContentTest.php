<?php

namespace MicroWeb\TiptapEditor\Tests\Feature;

use Illuminate\Auth\GenericUser;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use MicroWeb\TiptapEditor\Support\TemporaryMediaOwner;
use MicroWeb\TiptapEditor\Tests\TestCase;

final class ImageUploadContentTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        config(['tiptap-editor.image_upload.enabled' => true, 'tiptap-editor.image_upload.disk' => 'public']);
        $this->actingAs(new GenericUser(['id' => 1801]), 'web');
        Gate::define('tiptap-editor.upload', static fn (GenericUser $user): bool => true);
    }

    private function png(): string
    {
        return base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAAFElEQVR4nGPUSNnCwMDAxMDAgKAAF4gBRrRYoVYAAAAASUVORK5CYII=', true);
    }

    private function upload(string $name, string $bytes)
    {
        return $this->post(route('tiptap-editor.media.store'), ['image' => UploadedFile::fake()->createWithContent($name, $bytes)], ['Accept' => 'application/json']);
    }

    public function test_verified_type_not_client_filename_controls_extension(): void
    {
        $response = $this->upload('misleading.jpg', $this->png())->assertOk()->assertJsonStructure(['url', 'path', 'temporary']);
        $path = $response->json('path');
        self::assertStringEndsWith('.png', $path);
        self::assertTrue(TemporaryMediaOwner::owns($path, TemporaryMediaOwner::directory()));
        self::assertSame($this->png(), Storage::disk('public')->get($path));
    }

    public function test_disguised_text_is_rejected_without_storage_write(): void
    {
        $this->upload('fake.png', '<html>Not an image</html>')->assertUnprocessable()->assertJsonValidationErrors('image');
        self::assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_svg_is_rejected_without_storage_write(): void
    {
        $this->upload('vector.png', '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="3"/>')->assertUnprocessable()->assertJsonValidationErrors('image');
        self::assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_dimension_limit_rejects_before_storage_write(): void
    {
        config(['tiptap-editor.image_upload.max_height' => 2]);
        $this->upload('pixel.png', $this->png())->assertUnprocessable()->assertJsonValidationErrors('image');
        self::assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_truncated_image_rejected_before_storage_write(): void
    {
        $this->upload('broken.png', substr($this->png(), 0, -3))->assertUnprocessable()->assertJsonValidationErrors('image');
        self::assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_old_published_configuration_uses_dimension_defaults(): void
    {
        config(['tiptap-editor.image_upload' => ['enabled' => true, 'disk' => 'public', 'temporary_directory' => 'editor/tmp', 'permanent_directory' => 'editor/images', 'max_size' => 5120, 'allowed_mimes' => ['image/png']]]);
        $this->upload('pixel.png', $this->png())->assertOk();
    }
}
