import type { ImageUploadResult } from '../types/media'
import { normalizeImageSource } from '../utils/sanitizeHtml'

interface UseImageUploadOptions {
    uploadUrl?: string
    onImageUpload?: (file: File) => Promise<ImageUploadResult>
}

// The host callback and HTTP endpoint share one runtime contract. A path is
// metadata, not proof of ownership; only the server can authorize finalization.
function validateResult(value: unknown): ImageUploadResult {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error('Invalid image upload response.')
    }
    const result = value as Record<string, unknown>
    const url = typeof result.url === 'string' ? normalizeImageSource(result.url) : ''
    if (!url) throw new Error('Image upload returned an invalid URL.')
    if (result.path !== undefined && typeof result.path !== 'string') {
        throw new Error('Invalid image upload path.')
    }
    if (result.temporary !== undefined && typeof result.temporary !== 'boolean') {
        throw new Error('Invalid image upload temporary flag.')
    }
    return { url, path: result.path, temporary: result.temporary ?? false }
}

export function useImageUpload({
    uploadUrl = '/tiptap-editor/media',
    onImageUpload,
}: UseImageUploadOptions = {}) {
    const uploadImage = async (file: File): Promise<ImageUploadResult> => {
        if (onImageUpload) return validateResult(await onImageUpload(file))

        // A custom callback is the explicit escape hatch for host-managed
        // uploads. Never forward a Laravel CSRF token to a different origin.
        const endpoint = new URL(uploadUrl, window.location.href)
        if (endpoint.origin !== window.location.origin || endpoint.username || endpoint.password) {
            throw new Error('Image upload endpoint must be same-origin.')
        }
        const body = new FormData()
        body.append('image', file)
        const token = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content
        const headers: Record<string, string> = { Accept: 'application/json' }
        if (token) headers['X-CSRF-TOKEN'] = token
        const response = await fetch(endpoint.href, {
            method: 'POST', headers, body, credentials: 'same-origin', redirect: 'error',
        })
        let result: unknown
        try {
            result = await response.json()
        } catch {
            throw new Error(`Image upload returned an invalid response (${response.status}).`)
        }
        if (!response.ok) {
            const message = typeof result === 'object' && result !== null && 'message' in result
                ? result.message : undefined
            throw new Error(typeof message === 'string' && message ? message : `Image upload failed (${response.status}).`)
        }
        return validateResult(result)
    }
    return { uploadImage }
}
