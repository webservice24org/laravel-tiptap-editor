<?php

namespace MicroWeb\TiptapEditor\Http\Controllers;

use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use MicroWeb\TiptapEditor\Exceptions\MediaStorageBusyException;
use MicroWeb\TiptapEditor\Http\Requests\MediaUploadRequest;
use MicroWeb\TiptapEditor\Support\MediaPath;
use MicroWeb\TiptapEditor\Support\MediaStorageLock;
use MicroWeb\TiptapEditor\Support\TemporaryMediaOwner;

class MediaUploadController extends Controller
{
    public function __invoke(
        MediaUploadRequest $request
    ): JsonResponse {
        $diskName = (string) config(
            'tiptap-editor.image_upload.disk',
            'public'
        );

        $temporaryDirectory = TemporaryMediaOwner::directory();

        $file = $request->file(
            'image'
        );

        $filename = (string) Str::uuid().'.'.$request->validatedImageExtension();

        $expectedPath = $temporaryDirectory.'/'.$filename;
        abort_unless(
            MediaPath::isChild($expectedPath, $temporaryDirectory),
            500,
            'Invalid generated media path.'
        );

        try {
            return MediaStorageLock::run($diskName, function () use ($file, $temporaryDirectory, $filename, $diskName, $expectedPath): JsonResponse {
                $path = $file->storeAs(
                    $temporaryDirectory,
                    $filename,
                    $diskName
                );

                abort_unless(
                    is_string($path) && $path === $expectedPath,
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
            });
        } catch (MediaStorageBusyException) {
            abort(503, 'Editor media storage is busy. Retry shortly.', ['Retry-After' => '1']);
        }
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
