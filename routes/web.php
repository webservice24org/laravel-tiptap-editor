<?php

use Illuminate\Support\Facades\Route;
use MicroWeb\TiptapEditor\Http\Controllers\MediaUploadController;

Route::middleware([
    'web',
])->group(function () {
    Route::post(
        '/tiptap-editor/media',
        MediaUploadController::class
    )->name(
        'tiptap-editor.media.store'
    );
});
