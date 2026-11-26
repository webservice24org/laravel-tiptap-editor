<?php

namespace MicroWeb\TiptapEditor\Tests\Feature;

use Illuminate\Filesystem\Filesystem;
use Illuminate\Http\Middleware\SetCacheHeaders;
use MicroWeb\TiptapEditor\Http\Controllers\MediaUploadController;
use MicroWeb\TiptapEditor\Support\UploadRouteSettings;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Process\Process;

/** Cache commands and subsequent boots use real Laravel, not Testbench's in-memory config. */
final class CacheCompatibilityTest extends TestCase
{
    private string $root;
    private Filesystem $files;

    protected function setUp(): void
    {
        parent::setUp();
        $this->files = new Filesystem();
        $this->root = rtrim(str_replace('\\', '/', sys_get_temp_dir()), '/').'/mw-editor-cache-'.bin2hex(random_bytes(12));
        foreach (['bootstrap/cache', 'config', 'routes', 'app', 'storage/app/public', 'storage/framework/cache/data', 'storage/framework/sessions', 'storage/framework/views', 'storage/logs'] as $directory) {
            $this->files->ensureDirectoryExists($this->root.'/'.$directory);
        }
        $this->files->put($this->root.'/.editor-cache-test', 'disposable');
        $this->files->put($this->root.'/composer.json', json_encode(['autoload' => ['psr-4' => ['App\\' => 'app/']]], JSON_THROW_ON_ERROR));
        $this->files->put($this->root.'/bootstrap/app.php', <<<'BOOT'
<?php
return \Illuminate\Foundation\Application::configure(basePath: dirname(__DIR__))
    ->withProviders([\MicroWeb\TiptapEditor\TiptapEditorServiceProvider::class])
    ->withEvents(false)
    ->withRouting(web: __DIR__.'/../routes/web.php')
    ->withMiddleware()
    ->withExceptions()
    ->create();
BOOT);
        $this->files->put($this->root.'/routes/web.php', <<<'ROUTES'
<?php
\Illuminate\Support\Facades\Route::get('/cache-host/ping', static fn () => response()->json(['ok' => true]))->name('cache-host.ping');
ROUTES);
        $this->config('app', ['name' => 'Editor cache fixture', 'env' => 'testing', 'debug' => false, 'url' => 'http://localhost', 'key' => 'base64:'.base64_encode(str_repeat('c', 32))]);
        $this->config('cache', ['default' => 'file', 'limiter' => 'file', 'prefix' => 'editor_fixture', 'stores' => ['file' => ['driver' => 'file', 'path' => $this->root.'/storage/framework/cache/data', 'lock_path' => $this->root.'/storage/framework/cache/data']]]);
        $this->config('session', ['driver' => 'array', 'cookie' => 'editor_fixture_session']);
        $this->config('filesystems', ['default' => 'public', 'disks' => ['public' => ['driver' => 'local', 'root' => $this->root.'/storage/app/public', 'url' => '/storage', 'throw' => true]]]);
        $this->config('auth', ['defaults' => ['guard' => 'web'], 'guards' => ['web' => ['driver' => 'session', 'provider' => 'users'], 'editor-admin' => ['driver' => 'session', 'provider' => 'users']], 'providers' => ['users' => ['driver' => 'database', 'table' => 'users']]]);
        $this->config('database', ['default' => 'sqlite', 'connections' => ['sqlite' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]]);
        $this->config('logging', ['default' => 'single', 'channels' => ['single' => ['driver' => 'single', 'path' => $this->root.'/storage/logs/laravel.log']]]);
        $this->profile();
    }

    protected function tearDown(): void
    {
        if (isset($this->root) && is_file($this->root.'/.editor-cache-test')) {
            $this->files->deleteDirectory($this->root);
        }
        parent::tearDown();
    }

    private function config(string $name, array $values): void
    {
        $this->files->put($this->root.'/config/'.$name.'.php', '<?php return '.var_export($values, true).';'.PHP_EOL);
    }

    private function profile(bool $enabled = true, string $ability = 'cache-fixture.upload', bool $schedule = false): void
    {
        $this->config('tiptap-editor', [
            'image_upload' => ['enabled' => $enabled, 'disk' => 'public', 'temporary_directory' => 'cache-editor/tmp', 'permanent_directory' => 'cache-editor/images'],
            'upload_route' => ['guard' => 'editor-admin', 'ability' => $ability, 'attempts_per_minute' => 2, 'additional_middleware' => [SetCacheHeaders::class.':private']],
            'media_lock' => ['store' => 'file', 'seconds' => 120],
            'cleanup' => ['schedule' => $schedule],
        ]);
    }

    private function runWorker(string ...$arguments): string
    {
        $process = new Process([PHP_BINARY, dirname(__DIR__).'/Fixtures/cache-host/worker.php', $this->root, ...$arguments], $this->root, [
            'APP_ENV' => 'testing',
            'LARAVEL_STORAGE_PATH' => false,
            'COMPOSER_VENDOR_DIR' => false,
            'APP_CONFIG_CACHE' => 'bootstrap/cache/config.php',
            'APP_ROUTES_CACHE' => 'bootstrap/cache/routes.php',
            'APP_SERVICES_CACHE' => 'bootstrap/cache/services.php',
            'APP_PACKAGES_CACHE' => 'bootstrap/cache/packages.php',
            'APP_EVENTS_CACHE' => 'bootstrap/cache/events.php',
            'TIPTAP_EDITOR_UPLOAD_ENABLED' => 'false',
            'TIPTAP_EDITOR_CLEANUP_SCHEDULE' => 'false',
        ]);
        $process->setTimeout(60);
        $process->run();
        self::assertSame(0, $process->getExitCode(), implode(' ', $arguments)."\n".$process->getOutput()."\n".$process->getErrorOutput());
        return $process->getOutput();
    }

    private function inspect(): array
    {
        return json_decode($this->runWorker('inspect'), true, 512, JSON_THROW_ON_ERROR);
    }

    private function request(string $actor, string $file = ''): array
    {
        return json_decode($this->runWorker('request', $actor, $file), true, 512, JSON_THROW_ON_ERROR);
    }

    private function artisan(string $command): string
    {
        return $this->runWorker('artisan', $command);
    }

    private function assertRouteContract(array $state, string $guard, string $ability): void
    {
        self::assertSame('tiptap-editor/media', $state['uri']);
        self::assertContains('POST', $state['methods']);
        self::assertSame(MediaUploadController::class.'@__invoke', $state['action']);
        foreach (['web', 'auth:'.$guard, 'throttle:'.UploadRouteSettings::LIMITER, 'can:'.$ability] as $middleware) {
            self::assertContains($middleware, $state['middleware']);
            self::assertNotContains($middleware, array_values(array_diff($state['host_middleware'], ['web'])));
        }
        self::assertTrue($state['csrf_middleware']);
        self::assertTrue($state['limiter']);
        self::assertTrue($state['cleanup_command']);
        self::assertTrue($state['services_singleton']);
        self::assertSame([$this->root.'/bootstrap/cache/config.php', $this->root.'/bootstrap/cache/routes.php'], array_map(static fn (string $path): string => str_replace('\\', '/', $path), $state['cache_paths']));
    }

    public function test_configuration_cache_snapshot_and_clear_use_fresh_boots(): void
    {
        $initial = $this->inspect();
        self::assertFalse($initial['config_cached']);
        self::assertFalse($initial['routes_cached']);
        self::assertTrue($initial['enabled']);
        $this->artisan('config:cache');
        self::assertFileExists($this->root.'/bootstrap/cache/config.php');
        $this->profile(false, 'cache-fixture.changed', true);
        $cached = $this->inspect();
        self::assertTrue($cached['config_cached']);
        self::assertTrue($cached['enabled']);
        self::assertSame('cache-fixture.upload', $cached['ability']);
        self::assertSame('cache-editor/tmp', $cached['temporary']);
        self::assertSame(120, $cached['lock_seconds']);
        self::assertSame(0, $cached['cleanup_events']);
        $this->assertRouteContract($cached, 'editor-admin', 'cache-fixture.upload');
        $this->artisan('config:clear');
        self::assertFileDoesNotExist($this->root.'/bootstrap/cache/config.php');
        $fresh = $this->inspect();
        self::assertFalse($fresh['config_cached']);
        self::assertFalse($fresh['enabled']);
        self::assertSame(1, $fresh['cleanup_events']);
        $this->assertRouteContract($fresh, 'editor-admin', 'cache-fixture.changed');
    }

    public function test_route_cache_retains_middleware_until_cleared(): void
    {
        $this->artisan('route:cache');
        self::assertFileExists($this->root.'/bootstrap/cache/routes.php');
        $cached = $this->inspect();
        self::assertTrue($cached['routes_cached']);
        self::assertFalse($cached['config_cached']);
        $this->assertRouteContract($cached, 'editor-admin', 'cache-fixture.upload');
        self::assertContains(SetCacheHeaders::class.':private', $cached['middleware']);
        $this->profile(true, 'cache-fixture.changed');
        $stale = $this->inspect();
        self::assertSame('cache-fixture.changed', $stale['ability']);
        self::assertContains('can:cache-fixture.upload', $stale['middleware']);
        self::assertNotContains('can:cache-fixture.changed', $stale['middleware']);
        $this->artisan('route:clear');
        self::assertFileDoesNotExist($this->root.'/bootstrap/cache/routes.php');
        $fresh = $this->inspect();
        self::assertFalse($fresh['routes_cached']);
        $this->assertRouteContract($fresh, 'editor-admin', 'cache-fixture.changed');
    }

    public function test_both_caches_preserve_real_upload_authorization_and_rate_limiting(): void
    {
        $this->artisan('config:cache');
        $this->artisan('route:cache');
        $state = $this->inspect();
        self::assertTrue($state['config_cached']);
        self::assertTrue($state['routes_cached']);
        $this->assertRouteContract($state, 'editor-admin', 'cache-fixture.upload');
        $guest = $this->request('guest', 'png');
        self::assertSame(401, $guest['status']);
        self::assertSame([], $guest['files']);
        $denied = $this->request('deny', 'png');
        self::assertSame(403, $denied['status']);
        self::assertSame([], $denied['files']);
        $accepted = $this->request('allow', 'png');
        self::assertSame(200, $accepted['status'], json_encode($accepted));
        $path = $accepted['json']['path'];
        self::assertMatchesRegularExpression('~^cache-editor/tmp/owner-[a-f0-9]{64}/[a-f0-9-]+\\.png$~', $path);
        self::assertSame('/storage/'.$path, $accepted['json']['url']);
        self::assertTrue($accepted['json']['temporary']);
        self::assertSame([$path], $accepted['files']);
        self::assertFileExists($this->root.'/storage/app/public/'.$path);
        self::assertSame(422, $this->request('allow')['status']);
        self::assertSame(429, $this->request('allow')['status']);
        self::assertSame(422, $this->request('other')['status']);
        self::assertStringContainsString('Deleted 0 temporary media file(s).', $this->artisan('tiptap-editor:cleanup'));
        self::assertFileExists($this->root.'/storage/app/public/'.$path);
    }

    public function test_legacy_published_config_preserves_secure_defaults_with_both_caches(): void
    {
        $this->config('tiptap-editor', ['image_upload' => ['enabled' => false, 'disk' => 'public'], 'cleanup' => ['schedule' => false]]);
        $this->artisan('config:cache');
        $this->artisan('route:cache');
        $state = $this->inspect();
        self::assertTrue($state['config_cached']);
        self::assertTrue($state['routes_cached']);
        $this->assertRouteContract($state, 'web', 'tiptap-editor.upload');
        self::assertSame(20, $state['attempts']);
        $disabled = $this->request('allow', 'png');
        self::assertSame(403, $disabled['status']);
        self::assertSame([], $disabled['files']);
    }

    public function test_actual_config_publication_and_cache_rebuild(): void
    {
        $this->artisan('vendor:publish');
        $published = $this->root.'/config/tiptap-editor.php';
        self::assertFileExists($published);
        self::assertSame(hash_file('sha256', dirname(__DIR__, 2).'/config/tiptap-editor.php'), hash_file('sha256', $published));
        $this->artisan('config:cache');
        $this->artisan('route:cache');
        $state = $this->inspect();
        $this->assertRouteContract($state, 'web', 'tiptap-editor.upload');
        self::assertTrue($state['config_cached']);
        self::assertTrue($state['routes_cached']);
        self::assertFalse($state['enabled']);
        $this->artisan('route:clear');
        $this->artisan('config:clear');
        $this->profile(true, 'cache-fixture.rebuilt');
        $this->artisan('config:cache');
        $this->artisan('route:cache');
        $rebuilt = $this->inspect();
        $this->assertRouteContract($rebuilt, 'editor-admin', 'cache-fixture.rebuilt');
        self::assertTrue($rebuilt['config_cached']);
        self::assertTrue($rebuilt['routes_cached']);
        self::assertTrue($rebuilt['enabled']);
    }
}
