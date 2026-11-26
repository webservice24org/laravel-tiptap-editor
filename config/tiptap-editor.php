<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Image Uploads
    |--------------------------------------------------------------------------
    */

    'image_upload' => [
        'enabled' => env(
            'TIPTAP_EDITOR_UPLOAD_ENABLED',
            true
        ),

        'disk' => env(
            'TIPTAP_EDITOR_DISK',
            'public'
        ),

        'temporary_directory' => env(
            'TIPTAP_EDITOR_TEMP_DIRECTORY',
            'editor/tmp'
        ),

        'permanent_directory' => env(
            'TIPTAP_EDITOR_IMAGE_DIRECTORY',
            'editor/images'
        ),

        'temporary_lifetime' => (int) env(
            'TIPTAP_EDITOR_TEMP_LIFETIME',
            24
        ),

        /*
         * Kept false deliberately. The package never deletes permanent
         * media merely because it is no longer referenced by editor HTML.
         */
        'delete_unreferenced_on_save' => false,

        'max_size' => (int) env(
            'TIPTAP_EDITOR_MAX_IMAGE_SIZE',
            5120
        ),

        // Limits apply to the actual uploaded bytes and reported image canvas.
        'max_width' => 8192,
        'max_height' => 8192,
        'max_pixels' => 40000000,

        'allowed_mimes' => [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
        ],
    ],

    /*
     * Built-in upload endpoint only. Hosts must define the configured Gate
     * ability; authentication alone does not grant upload permission.
     * Existing custom upload endpoints retain their own authorization.
     */
    'upload_route' => [
        'guard' => 'web',
        'ability' => 'tiptap-editor.upload',
        'attempts_per_minute' => 20,
        'additional_middleware' => [],
    ],

    /*
    |--------------------------------------------------------------------------
    | Temporary Media Cleanup
    |--------------------------------------------------------------------------
    |
    | When enabled, the package registers its cleanup command with Laravel's
    | scheduler once per hour. The host application must still run Laravel's
    | scheduler (for example with `php artisan schedule:work` locally or the
    | normal production cron entry).
    |
    */

    // All cooperating workers must use the same lock-capable cache store.
    // Null selects Laravel's default cache store; the lease must outlast a batch.
    'media_lock' => [
        'store' => env('TIPTAP_EDITOR_MEDIA_LOCK_STORE'),
        'seconds' => (int) env('TIPTAP_EDITOR_MEDIA_LOCK_SECONDS', 300),
    ],

    'cleanup' => [
        'schedule' => env(
            'TIPTAP_EDITOR_CLEANUP_SCHEDULE',
            true
        ),
    ],
];
