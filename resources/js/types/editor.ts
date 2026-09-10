import type {
    ImageUploadResult,
} from './media'

import type {
    NewsSearchHandler,
} from './newsBlock'

export type EditorMode =
    'visual' |
    'code'

export interface EditorExtensionOptions {
    imageUploadUrl?: string

    onImageUpload?: (
        file: File
    ) => Promise<ImageUploadResult>
}

export interface TiptapEditorProps
    extends EditorExtensionOptions {
    /**
     * Current HTML value.
     */
    value?: string

    /**
     * Receives sanitized editor HTML.
     *
     * In Code mode, raw unsanitized source stays local
     * until the user returns to Visual mode.
     */
    onChange?: (
        html: string
    ) => void

    /**
     * Minimum editor/content area height in pixels.
     */
    minHeight?: number

    /**
     * Optional host-provided search handler for News Block.
     * The editor package does not depend on any NewsPost model.
     */
    onNewsSearch?:
        NewsSearchHandler
}
