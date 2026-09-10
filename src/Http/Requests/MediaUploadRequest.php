<?php

namespace MicroWeb\TiptapEditor\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class MediaUploadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) config(
            'tiptap-editor.image_upload.enabled',
            true
        );
    }

    public function rules(): array
    {
        $maxSize = max(
            1,
            (int) config(
                'tiptap-editor.image_upload.max_size',
                5120
            )
        );

        $allowedMimes = array_values(
            array_filter(
                (array) config(
                    'tiptap-editor.image_upload.allowed_mimes',
                    [
                        'image/jpeg',
                        'image/png',
                        'image/webp',
                        'image/gif',
                    ]
                )
            )
        );

        return [
            'image' => [
                'required',
                'file',
                'max:'.$maxSize,
                'mimetypes:'
                    .implode(
                        ',',
                        $allowedMimes
                    ),
            ],
        ];
    }
}
