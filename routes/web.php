<?php

use Illuminate\Support\Facades\Route;
use MicroWeb\TiptapEditor\Http\Controllers\MediaUploadController;
use MicroWeb\TiptapEditor\Support\UploadRouteSettings;

Route::post('/tiptap-editor/media', MediaUploadController::class)
    ->middleware(UploadRouteSettings::middleware())
    ->name('tiptap-editor.media.store');
