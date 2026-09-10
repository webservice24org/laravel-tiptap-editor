<?php

namespace MicroWeb\TiptapEditor\Http\Controllers;

use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use MicroWeb\TiptapEditor\Http\Requests\MediaUploadRequest;

class MediaUploadController extends Controller
{
    public function __invoke(
        MediaUploadRequest $request
    ): JsonResponse {
        $diskName = (string) config(
            'tiptap-editor.image_upload.disk',
            'public'
        );

        $temporaryDirectory = trim(
            (string) config(
                'tiptap-editor.image_upload.temporary_directory',
                'editor/tmp'
            ),
            '/'
        );

        $file = $request->file(
            'image'
        );

        $extension = strtolower(
            $file->extension()
        );

        $filename = (string) Str::uuid();

        if ($extension !== '') {
            $filename .= '.'
                .$extension;
        }

        $path = $file->storeAs(
            $temporaryDirectory,
            $filename,
            $diskName
        );

        abort_unless(
            is_string(
                $path
            ),
            500,
            'Unable to store uploaded media.'
        );

        return response()->json([
            'url' =>
                $this->publicUrl(
                    $diskName,
                    $path
                ),

            'path' =>
                $path,

            'temporary' =>
                true,
        ]);
    }

    private function publicUrl(
        string $diskName,
        string $path
    ): string {
        if ($diskName === 'public') {
            return '/storage/'
                .ltrim(
                    $path,
                    '/'
                );
        }

        $disk = Storage::disk(
            $diskName
        );

        if (
            ! $disk instanceof
            FilesystemAdapter
        ) {
            abort(
                500,
                'Configured filesystem disk does not support public URLs.'
            );
        }

        return $disk->url(
            $path
        );
    }
}
