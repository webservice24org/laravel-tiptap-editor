<?php

namespace MicroWeb\TiptapEditor;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\ServiceProvider;
use MicroWeb\TiptapEditor\Console\Commands\CleanupTemporaryMediaCommand;
use MicroWeb\TiptapEditor\Services\EditorHtmlSanitizer;
use MicroWeb\TiptapEditor\Services\EditorMediaService;
use MicroWeb\TiptapEditor\Support\UploadRouteSettings;

class TiptapEditorServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(
            __DIR__.'/../config/tiptap-editor.php',
            'tiptap-editor'
        );

        $this->app->singleton(
            EditorHtmlSanitizer::class,
            fn () => new EditorHtmlSanitizer()
        );

        $this->app->singleton(
            EditorMediaService::class,
            fn () => new EditorMediaService()
        );
    }

    public function boot(): void
    {
        $this->publishes([
            __DIR__.'/../config/tiptap-editor.php' =>
                config_path('tiptap-editor.php'),
        ], 'tiptap-editor-config');

        // Register the named limiter even when routes are cached. The closure
        // belongs to the limiter registry, not to a serialized route action.
        RateLimiter::for(UploadRouteSettings::LIMITER, static function (Request $request): Limit {
            $user = $request->user();
            $key = $user === null
                ? 'ip:'.$request->ip()
                : 'user:'.UploadRouteSettings::guard().':'.$user->getAuthIdentifier();

            return Limit::perMinute(UploadRouteSettings::attemptsPerMinute())->by($key);
        });

        $this->loadRoutesFrom(
            __DIR__.'/../routes/web.php'
        );

        if (! $this->app->runningInConsole()) {
            return;
        }

        $this->commands([
            CleanupTemporaryMediaCommand::class,
        ]);

        if (
            (bool) config(
                'tiptap-editor.cleanup.schedule',
                true
            )
        ) {
            Schedule::command(
                'tiptap-editor:cleanup'
            )
                ->hourly()
                ->withoutOverlapping();
        }
    }
}
