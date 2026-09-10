/*
|--------------------------------------------------------------------------
| MicroWeb Laravel Tiptap Editor - Public JavaScript API
|--------------------------------------------------------------------------
|
| Keep this file intentionally small.
| Anything exported here becomes part of the package's public API.
|
*/

export {
    default as TiptapEditor,
} from './components/TiptapEditor'

export {
    default,
} from './components/TiptapEditor'

export {
    sanitizeEditorHtml,
} from './utils/sanitizeHtml'

export {
    createEditorExtensions,
} from './extensions/editorExtensions'

export type {
    EditorExtensionOptions,
    EditorMode,
    TiptapEditorProps,
} from './types/editor'

export type {
    ImageData,
    ImageUploadResult,
} from './types/media'

export type {
    NewsBlockData,
    NewsBlockStyle,
    NewsSearchHandler,
    NewsSearchResult,
} from './types/newsBlock'
