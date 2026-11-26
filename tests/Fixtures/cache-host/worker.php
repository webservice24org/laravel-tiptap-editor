<?php

// Runs only against a disposable host prepared by CacheCompatibilityTest.
// Each invocation boots a new application; no package or host cache is reused.
use Illuminate\Auth\GenericUser;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Contracts\Console\Kernel as ConsoleKernel;
use Illuminate\Contracts\Http\Kernel as HttpKernel;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use MicroWeb\TiptapEditor\Services\EditorHtmlSanitizer;
use MicroWeb\TiptapEditor\Services\EditorMediaService;
use MicroWeb\TiptapEditor\Support\UploadRouteSettings;
use Symfony\Component\Console\Output\BufferedOutput;

require dirname(__DIR__, 3).'/vendor/autoload.php';

$root = $argv[1] ?? '';
$mode = $argv[2] ?? '';
if (! is_dir($root) || ! is_file($root.'/.editor-cache-test') || ! is_file($root.'/bootstrap/app.php')) {
    throw new RuntimeException('A disposable cache test host is required.');
}
$app = require $root.'/bootstrap/app.php';
$console = $app->make(ConsoleKernel::class);
$console->bootstrap();

if ($mode === 'artisan') {
    $command = $argv[3] ?? '';
    $arguments = match ($command) {
        'config:cache', 'config:clear', 'route:cache', 'route:clear' => [],
        'vendor:publish' => ['--tag' => 'tiptap-editor-config', '--force' => true],
        'tiptap-editor:cleanup' => ['--hours' => 24],
        default => throw new RuntimeException('Unsupported fixture command.'),
    };
    $output = new BufferedOutput();
    $status = $console->call($command, $arguments, $output);
    echo $output->fetch();
    exit($status);
}

// Resolving the HTTP kernel installs the host's default web middleware and aliases.
$http = $app->make(HttpKernel::class);
$routes = $app['router']->getRoutes();
$route = $routes->getByName('tiptap-editor.media.store');
if ($route === null) {
    throw new RuntimeException('Editor upload route is absent.');
}

if ($mode === 'inspect') {
    $events = array_filter($app->make(Schedule::class)->events(), static fn ($event): bool =>
        str_contains((string) ($event->command ?? ''), 'tiptap-editor:cleanup'));
    $middleware = $app['router']->gatherRouteMiddleware($route);
    $csrf = array_filter($middleware, static fn ($name): bool =>
        is_string($name) && (str_contains($name, 'CsrfToken') || str_contains($name, 'PreventRequestForgery')));
    $result = [
        'config_cached' => $app->configurationIsCached(),
        'routes_cached' => $app->routesAreCached(),
        'cache_paths' => [$app->getCachedConfigPath(), $app->getCachedRoutesPath()],
        'uri' => $route->uri(),
        'methods' => $route->methods(),
        'action' => $route->getAction('uses'),
        'middleware' => $route->gatherMiddleware(),
        'csrf_middleware' => count($csrf) > 0,
        'guard' => UploadRouteSettings::guard(),
        'ability' => UploadRouteSettings::ability(),
        'attempts' => UploadRouteSettings::attemptsPerMinute(),
        'enabled' => config('tiptap-editor.image_upload.enabled'),
        'temporary' => config('tiptap-editor.image_upload.temporary_directory'),
        'lock_seconds' => config('tiptap-editor.media_lock.seconds'),
        'limiter' => is_callable(RateLimiter::limiter(UploadRouteSettings::LIMITER)),
        'cleanup_command' => array_key_exists('tiptap-editor:cleanup', $console->all()),
        'cleanup_events' => count($events),
        'services_singleton' => $app->make(EditorHtmlSanitizer::class) === $app->make(EditorHtmlSanitizer::class)
            && $app->make(EditorMediaService::class) === $app->make(EditorMediaService::class),
        'host_middleware' => $routes->getByName('cache-host.ping')?->gatherMiddleware(),
    ];
} elseif ($mode === 'request') {
    $actor = $argv[3] ?? '';
    if (! in_array($actor, ['guest', 'deny', 'allow', 'other'], true)) {
        throw new RuntimeException('Unsupported fixture actor.');
    }
    if ($actor !== 'guest') {
        Auth::guard(UploadRouteSettings::guard())->setUser(new GenericUser(['id' => match ($actor) {
            'deny' => 91, 'allow' => 92, 'other' => 93,
        }]));
        if ($actor !== 'deny') {
            Gate::define(UploadRouteSettings::ability(), static fn (GenericUser $user): bool => true);
        }
    }
    $files = [];
    if (($argv[4] ?? '') === 'png') {
        $files['image'] = UploadedFile::fake()->createWithContent('client.jpg', base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGP4/x8AAwAB//wl3FEAAAAASUVORK5CYII=', true
        ));
    }
    $request = Request::create('http://localhost/tiptap-editor/media', 'POST', [], [], $files, ['HTTP_ACCEPT' => 'application/json']);
    $response = $http->handle($request);
    $http->terminate($request, $response);
    if ($response->getStatusCode() >= 500) {
        $log = $root.'/storage/logs/laravel.log';
        throw new RuntimeException('Fixture HTTP failure: '.$response->getStatusCode().' '.(is_file($log) ? substr((string) file_get_contents($log), -12000) : (string) $response->getContent()));
    }
    $result = [
        'status' => $response->getStatusCode(),
        'json' => json_decode((string) $response->getContent(), true),
        'files' => Storage::disk('public')->allFiles(),
    ];
} else {
    throw new RuntimeException('Unsupported fixture operation.');
}

echo json_encode($result, JSON_THROW_ON_ERROR).PHP_EOL;
