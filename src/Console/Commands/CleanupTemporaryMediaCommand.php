<?php

namespace MicroWeb\TiptapEditor\Console\Commands;

use Illuminate\Console\Command;
use MicroWeb\TiptapEditor\Services\EditorMediaService;

class CleanupTemporaryMediaCommand extends Command
{
    protected $signature =
        'tiptap-editor:cleanup
        {--hours= : Delete temporary media older than this many hours}';

    protected $description =
        'Delete abandoned temporary Tiptap editor media files.';

    public function handle(
        EditorMediaService $mediaService
    ): int {
        $hoursOption =
            $this->option(
                'hours'
            );

        $hours =
            $hoursOption !== null
                ? max(
                    1,
                    (int) $hoursOption
                )
                : null;

        $deleted =
            $mediaService
                ->cleanupTemporaryMedia(
                    $hours
                );

        $this->info(
            "Deleted {$deleted} temporary media file(s)."
        );

        return self::SUCCESS;
    }
}
