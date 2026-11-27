import DefaultEditor, {
    TiptapEditor, sanitizeEditorHtml, createEditorExtensions,
    type TiptapEditorProps, type EditorExtensionOptions, type EditorMode,
    type ImageData, type ImageUploadResult, type NewsBlockData,
    type NewsBlockStyle, type NewsSearchHandler, type NewsSearchResult,
    type ImageAlignment, type ImageFigureOptions, type InsertNewsBlockOptions,
    type VideoAlignment, type VideoProvider,
} from '@webservice24org/laravel-tiptap-editor'
import type { Editor, Extensions } from '@tiptap/core'

type IsAny<T> = 0 extends (1 & T) ? true : false
const propsAreTyped: IsAny<TiptapEditorProps> = false
const extensionFactoryIsTyped: IsAny<ReturnType<typeof createEditorExtensions>> = false
const upload: NonNullable<TiptapEditorProps['onImageUpload']> = async (file: File): Promise<ImageUploadResult> => ({ url: '/storage/' + file.name, temporary: true })
const news: NewsSearchResult = { id: 1, title: 'Example', url: '/news/example', style: 'card' }
const search: NewsSearchHandler = async (query: string) => [{ ...news, title: query }]
const options: EditorExtensionOptions = { onImageUpload: upload }
const props: TiptapEditorProps = { ...options, value: '<p>Example</p>', minHeight: 300, onChange: html => { const value: string = html; void value }, onNewsSearch: search }
const component = <TiptapEditor {...props} />
const defaultComponent = <DefaultEditor {...props} />
const defaultAlias: typeof TiptapEditor = DefaultEditor
const extensions: Extensions = createEditorExtensions(options)
const clean: string = sanitizeEditorHtml('<p>Example</p>')
const mode: EditorMode = 'visual'
const image: ImageData = { src: '/image.png' }
const newsStyle: NewsBlockStyle = 'compact'
const block: NewsBlockData = { ...news, style: newsStyle }
const imageAlignment: ImageAlignment = 'center'
const imageOptions: ImageFigureOptions = { imageUploadUrl: '/media', onImageUpload: upload }
const newsOptions: InsertNewsBlockOptions = { newsId: 1, title: 'Example', url: '/news/example' }
const provider: VideoProvider = 'youtube'
const videoAlignment: VideoAlignment = 'right'
declare const editor: Editor
const imageCommand: boolean = editor.commands.insertImageFigure({ src: image.src, align: imageAlignment })
const newsCommand: boolean = editor.commands.insertNewsBlock(newsOptions)
const videoCommand: boolean = editor.commands.insertVideoEmbed({ src: 'https://www.youtube.com/embed/example', provider, align: videoAlignment })
// @ts-expect-error invalid editor mode
const badMode: EditorMode = 'other'
// @ts-expect-error minHeight must be numeric
const badProps: TiptapEditorProps = { minHeight: '300' }
// @ts-expect-error upload handler must resolve an object containing a URL
const badUpload: TiptapEditorProps = { onImageUpload: async () => ({ temporary: true }) }
// @ts-expect-error news handler must resolve an array of news results
const badNews: NewsSearchHandler = async () => ({ title: 'bad' })
// @ts-expect-error sanitizer accepts HTML strings
sanitizeEditorHtml(123)
// @ts-expect-error custom news command requires title and URL
editor.commands.insertNewsBlock({ newsId: 1 })
