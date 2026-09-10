<?php

namespace MicroWeb\TiptapEditor;

use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\ServiceProvider;
use MicroWeb\TiptapEditor\Console\Commands\CleanupTemporaryMediaCommand;
use MicroWeb\TiptapEditor\Services\EditorHtmlSanitizer;
use MicroWeb\TiptapEditor\Services\EditorMediaService;

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
