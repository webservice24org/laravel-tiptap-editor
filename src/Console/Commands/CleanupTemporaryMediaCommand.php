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

        if ($hoursOption !== null && ((! is_string($hoursOption) && ! is_int($hoursOption))
            || preg_match('/\A[1-9][0-9]{0,4}\z/D', (string) $hoursOption) !== 1
            || (int) $hoursOption > 87600)) {
            $this->error('The --hours option must be an integer from 1 to 87600.');
            return self::FAILURE;
        }

        $hours = $hoursOption === null ? null : (int) $hoursOption;

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
