<?php

namespace MicroWeb\TiptapEditor\Http\Requests;

use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;
use LogicException;
use MicroWeb\TiptapEditor\Support\ImageUploadInspector;
use MicroWeb\TiptapEditor\Support\InvalidUploadedImage;

class MediaUploadRequest extends FormRequest
{
    private ?array $imageInformation = null;

    public function authorize(): bool
    {
        return (bool) config('tiptap-editor.image_upload.enabled', true);
    }

    public function rules(): array
    {
        $settings = ImageUploadInspector::settings(config('tiptap-editor.image_upload', []));

        return [
            'image' => [
                'bail', 'required', 'file', 'max:'.$settings['max_size'],
                function (string $attribute, mixed $value, Closure $fail) use ($settings): void {
                    if (! $value instanceof UploadedFile || ! $value->isValid()) {
                        $fail('The image upload is invalid.');
                        return;
                    }
                    try {
                        $this->imageInformation = ImageUploadInspector::inspectFile($value->getPathname(), $settings);
                    } catch (InvalidUploadedImage $exception) {
                        $fail($exception->getMessage());
                    }
                },
            ],
        ];
    }

    public function validatedImageExtension(): string
    {
        return $this->imageInformation['extension'] ?? throw new LogicException('Image validation has not completed.');
    }
}
