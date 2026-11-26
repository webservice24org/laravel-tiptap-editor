<?php

namespace MicroWeb\TiptapEditor\Tests\Feature;

use Illuminate\Auth\GenericUser;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use InvalidArgumentException;
use MicroWeb\TiptapEditor\Services\EditorMediaService;
use MicroWeb\TiptapEditor\Support\TemporaryMediaOwner;
use MicroWeb\TiptapEditor\Tests\TestCase;
use Mockery;
use Ramsey\Uuid\Uuid;
use RuntimeException;

final class ManagedMediaFinalizationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config([
            'tiptap-editor.image_upload.disk' => 'public',
            'tiptap-editor.image_upload.temporary_directory' => 'editor/tmp',
            'tiptap-editor.image_upload.permanent_directory' => 'editor/images',
        ]);
        $this->actingAs(new GenericUser(['id' => 952]), 'web');
    }

    private function media(): EditorMediaService
    {
        return $this->app->make(EditorMediaService::class);
    }

    private function path(string $name = 'image.png'): string
    {
        return TemporaryMediaOwner::directory().'/'.$name;
    }

    private function figure(string $path, ?string $src = null): string
    {
        return '<figure data-mw-image data-mw-path="'.$path.'"><img src="'.($src ?? '/storage/'.$path).'"></figure>';
    }

    public function test_case_whitespace_unquoted_and_entity_attributes_are_parsed_and_rewritten(): void
    {
        $disk = Storage::fake('public');
        $path = $this->path();
        $disk->put($path, 'image');
        $encoded = str_replace('/image.png', '/&#105;mage.png', $path);
        $html = '<FIGURE DATA-MW-IMAGE DATA-MW-PATH = '.$encoded.'><IMG SRC = "/storage/'.$path.'"></FIGURE>';
        $result = $this->media()->finalize($html);
        $files = $disk->allFiles('editor/images');
        self::assertCount(1, $files);
        self::assertSame($files, $this->media()->extractManagedPaths($result));
        self::assertStringContainsString('src="/storage/'.$files[0].'"', $result);
        $disk->assertMissing($path);
    }

    public function test_comments_text_and_attribute_lookalikes_are_not_storage_references(): void
    {
        $path = $this->path();
        $html = '<!-- '.$this->figure($path).' --><p>data-mw-path="'.$path.'"</p>'
            .'<span title=\'data-mw-path="'.$path.'"\' not-data-mw-path="'.$path.'">Text</span>';
        Storage::shouldReceive('disk')->never();
        self::assertSame([], $this->media()->extractManagedPaths($html));
        self::assertSame($html, $this->media()->finalize($html));
    }

    public function test_duplicate_references_move_once_and_rewrite_each_associated_image_only(): void
    {
        $disk = Storage::fake('public');
        $path = $this->path();
        $disk->put($path, 'image');
        $html = $this->figure($path).'<p><img src="/storage/'.$path.'" alt="unmanaged"></p>'.$this->figure($path);
        $result = $this->media()->finalize($html);
        $files = $disk->allFiles('editor/images');
        self::assertCount(1, $files);
        self::assertSame(2, substr_count($result, 'data-mw-path="'.$files[0].'"'));
        self::assertSame(2, substr_count($result, 'src="/storage/'.$files[0].'"'));
        self::assertStringContainsString('src="/storage/'.$path.'" alt="unmanaged"', $result);
        $disk->assertMissing($path);
    }

    public function test_caption_formatting_and_unicode_are_preserved_semantically(): void
    {
        $disk = Storage::fake('public');
        $path = $this->path();
        $disk->put($path, 'image');
        $html = '<p><strong>বাংলা</strong></p><figure data-mw-image data-mw-path="'.$path.'" data-width="50" data-align="left">'
            .'<img src="/storage/'.$path.'" alt="বাংলা ছবি"><figcaption>চিত্র &amp; café</figcaption></figure>';
        $result = $this->media()->finalize($html);
        self::assertStringContainsString('data-width="50"', $result);
        self::assertStringContainsString('data-align="left"', $result);
        $decoded = html_entity_decode($result, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        self::assertStringContainsString('<strong>বাংলা</strong>', $decoded);
        self::assertStringContainsString('alt="বাংলা ছবি"', $decoded);
        self::assertStringContainsString('<figcaption>চিত্র & café</figcaption>', $decoded);
    }

    public function test_standalone_managed_image_is_supported(): void
    {
        $disk = Storage::fake('public');
        $path = $this->path();
        $disk->put($path, 'image');
        $result = $this->media()->finalize('<img data-mw-path="'.$path.'" src="/storage/'.$path.'">');
        $files = $disk->allFiles('editor/images');
        self::assertCount(1, $files);
        self::assertSame($files, $this->media()->extractManagedPaths($result));
        self::assertStringContainsString('src="/storage/'.$files[0].'"', $result);
    }

    public function test_unsupported_reference_element_is_rejected_before_storage(): void
    {
        Storage::shouldReceive('disk')->never();
        $this->expectException(InvalidArgumentException::class);
        $this->media()->finalize('<span data-mw-path="'.$this->path().'">Not an image</span>');
    }

    public function test_managed_figure_without_image_is_rejected_before_storage(): void
    {
        Storage::shouldReceive('disk')->never();
        $this->expectException(InvalidArgumentException::class);
        $this->media()->finalize('<figure data-mw-image data-mw-path="'.$this->path().'"><figcaption>Only caption</figcaption></figure>');
    }

    public function test_managed_figure_with_multiple_images_is_rejected_before_storage(): void
    {
        $path = $this->path();
        Storage::shouldReceive('disk')->never();
        $this->expectException(InvalidArgumentException::class);
        $this->media()->finalize('<figure data-mw-image data-mw-path="'.$path.'"><img src="/storage/'.$path.'"><img src="/other.png"></figure>');
    }

    public function test_nested_reference_is_rejected_before_storage(): void
    {
        $path = $this->path();
        Storage::shouldReceive('disk')->never();
        $this->expectException(InvalidArgumentException::class);
        $this->media()->finalize('<figure data-mw-image data-mw-path="'.$path.'"><img data-mw-path="'.$path.'" src="/storage/'.$path.'"></figure>');
    }

    public function test_mismatched_source_in_batch_leaves_all_temporary_files_intact(): void
    {
        $disk = Storage::fake('public');
        $first = $this->path('first.png');
        $second = $this->path('second.png');
        $disk->put($first, 'first');
        $disk->put($second, 'second');
        try {
            $this->media()->finalize($this->figure($first).$this->figure($second, 'https://example.org/other.png'));
            self::fail('A mismatched image source must stop the entire batch.');
        } catch (InvalidArgumentException) {
            $disk->assertExists([$first, $second]);
            self::assertSame([], $disk->allFiles('editor/images'));
        }
    }

    public function test_missing_source_in_batch_prevents_all_moves(): void
    {
        $disk = Storage::fake('public');
        $first = $this->path('first.png');
        $disk->put($first, 'first');
        try {
            $this->media()->finalize($this->figure($first).$this->figure($this->path('missing.png')));
            self::fail('A missing temporary file must stop the batch.');
        } catch (RuntimeException $exception) {
            self::assertStringContainsString('missing', $exception->getMessage());
            $disk->assertExists($first);
            self::assertSame([], $disk->allFiles('editor/images'));
        }
    }

    public function test_source_directory_is_not_a_media_file(): void
    {
        $disk = Storage::fake('public');
        $directory = $this->path('directory.png');
        $disk->put($directory.'/child.png', 'keep');
        try {
            $this->media()->finalize($this->figure($directory));
            self::fail('A directory must not be moved as a file.');
        } catch (RuntimeException $exception) {
            self::assertStringContainsString('missing', $exception->getMessage());
            $disk->assertExists($directory.'/child.png');
            self::assertSame([], $disk->allFiles('editor/images'));
        }
    }

    public function test_existing_destination_is_not_overwritten(): void
    {
        $disk = Storage::fake('public');
        $path = $this->path();
        $disk->put($path, 'new');
        $uuid = 'e7b6efc0-8cec-4af5-a87d-45850ee915a3';
        $destination = 'editor/images/'.$uuid.'.png';
        $disk->put($destination, 'existing');
        Str::createUuidsUsing(static fn () => Uuid::fromString($uuid));
        try {
            $this->media()->finalize($this->figure($path));
            self::fail('Existing destination must not be overwritten.');
        } catch (RuntimeException $exception) {
            self::assertStringContainsString('already exists', $exception->getMessage());
            self::assertSame('existing', $disk->get($destination));
            self::assertSame('new', $disk->get($path));
        } finally {
            Str::createUuidsNormally();
        }
    }

    public function test_non_public_disk_url_is_resolved_before_any_move(): void
    {
        config(['tiptap-editor.image_upload.disk' => 'custom']);
        $path = $this->path();
        $disk = Mockery::mock(FilesystemAdapter::class);
        $disk->shouldReceive('url')->with($path)->once()->andReturn('https://example.org/media/'.$path);
        $disk->shouldReceive('fileExists')->with($path)->once()->andReturn(true);
        $disk->shouldReceive('exists')->once()->andReturn(false);
        $disk->shouldReceive('url')->once()->with(Mockery::on(static fn ($value): bool => str_starts_with($value, 'editor/images/')))->andReturn('');
        $disk->shouldNotReceive('move');
        Storage::shouldReceive('disk')->with('custom')->once()->andReturn($disk);
        $this->expectException(RuntimeException::class);
        $this->media()->finalize($this->figure($path, 'https://example.org/media/'.$path));
    }

    public function test_move_failure_does_not_return_a_successful_rewrite(): void
    {
        $path = $this->path();
        $disk = Mockery::mock(FilesystemAdapter::class);
        $disk->shouldReceive('fileExists')->with($path)->times(3)->andReturn(true);
        $disk->shouldReceive('exists')->with(Mockery::on(static fn ($value): bool => str_starts_with($value, 'editor/images/')))->times(3)->andReturn(false);
        $disk->shouldReceive('move')->with($path, Mockery::type('string'))->once()->andReturn(false);
        Storage::shouldReceive('disk')->with('public')->once()->andReturn($disk);
        try {
            $this->media()->finalize($this->figure($path));
            self::fail('A failed move cannot return finalized HTML.');
        } catch (\MicroWeb\TiptapEditor\Exceptions\MediaFinalizationException $exception) {
            self::assertFalse($exception->requiresRecovery());
            self::assertSame([], $exception->recoveryEntries());
        }
    }

    public function test_second_move_failure_restores_first_and_does_not_return_rewritten_html(): void
    {
        $first = $this->path('first.png');
        $second = $this->path('second.png');
        $files = [$first => 'first', $second => 'second'];
        $disk = Mockery::mock(FilesystemAdapter::class);
        $disk->shouldReceive('fileExists')->andReturnUsing(static function ($path) use (&$files): bool {
            return isset($files[$path]);
        });
        $disk->shouldReceive('exists')->andReturnUsing(static function ($path) use (&$files): bool {
            return isset($files[$path]);
        });
        $disk->shouldReceive('move')->times(3)->andReturnUsing(static function ($source, $destination) use (&$files, $second): bool {
            if ($source === $second) {
                return false;
            }
            $files[$destination] = $files[$source];
            unset($files[$source]);
            return true;
        });
        $disk->shouldNotReceive('delete');
        Storage::shouldReceive('disk')->with('public')->once()->andReturn($disk);

        try {
            $this->media()->finalize($this->figure($first).$this->figure($second));
            self::fail('A partially failed finalization must not return rewritten HTML.');
        } catch (\MicroWeb\TiptapEditor\Exceptions\MediaFinalizationException $exception) {
            self::assertFalse($exception->requiresRecovery());
            ksort($files);
            self::assertSame([$first => 'first', $second => 'second'], $files);
        }
    }

}
