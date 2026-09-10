import type {
    ImageUploadResult,
} from '../types/media'

interface UseImageUploadOptions {
    uploadUrl?: string

    onImageUpload?: (
        file: File
    ) => Promise<ImageUploadResult>
}

export function useImageUpload({
    uploadUrl = '/tiptap-editor/media',
    onImageUpload,
}: UseImageUploadOptions = {}) {
    const uploadImage = async (
        file: File
    ): Promise<ImageUploadResult> => {
        /*
        |--------------------------------------------------------------------------
        | Custom host upload callback
        |--------------------------------------------------------------------------
        */

        if (onImageUpload) {
            return onImageUpload(
                file
            )
        }

        /*
        |--------------------------------------------------------------------------
        | Built-in Laravel upload endpoint
        |--------------------------------------------------------------------------
        */

        const formData =
            new FormData()

        formData.append(
            'image',
            file
        )

        const csrfToken =
            document
                .querySelector<HTMLMetaElement>(
                    'meta[name="csrf-token"]'
                )
                ?.getAttribute(
                    'content'
                )

        const headers:
            Record<string, string> = {
                Accept:
                    'application/json',
            }

        if (csrfToken) {
            headers[
                'X-CSRF-TOKEN'
            ] = csrfToken
        }

        const response =
            await fetch(
                uploadUrl,
                {
                    method:
                        'POST',

                    headers,

                    body:
                        formData,

                    credentials:
                        'same-origin',
                }
            )

        const result =
            await response.json()

        if (!response.ok) {
            throw new Error(
                result?.message ??
                    'Image upload failed.'
            )
        }

        if (!result?.url) {
            throw new Error(
                'Image upload returned no URL.'
            )
        }

        return {
            url:
                result.url,

            path:
                result.path,

            temporary:
                result.temporary ??
                false,
        }
    }

    return {
        uploadImage,
    }
}