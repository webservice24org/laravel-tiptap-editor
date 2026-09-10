import {
    useEffect,
    useRef,
    useState,
} from 'react'

import type {
    DragEvent,
} from 'react'

import type {
    Editor,
} from '@tiptap/react'

import Dialog from './Dialog'

import {
    useImageUpload,
} from '../../hooks/useImageUpload'

import type {
    ImageUploadResult,
} from '../../types/media'

interface ImageDialogProps {
    editor: Editor

    open: boolean

    onClose: () => void

    uploadUrl?: string

    onImageUpload?: (
        file: File
    ) => Promise<ImageUploadResult>
}

export default function ImageDialog({
    editor,
    open,
    onClose,
    uploadUrl,
    onImageUpload,
}: ImageDialogProps) {
    const fileInputRef =
        useRef<HTMLInputElement>(
            null
        )

    const [file, setFile] =
        useState<File | null>(
            null
        )

    const [preview, setPreview] =
        useState('')

    const [imageUrl, setImageUrl] =
        useState('')

    const [alt, setAlt] =
        useState('')

    const [caption, setCaption] =
        useState('')

    const [error, setError] =
        useState('')

    const [uploading, setUploading] =
        useState(false)

    const {
        uploadImage,
    } = useImageUpload({
        uploadUrl,
        onImageUpload,
    })

    useEffect(() => {
        if (!open) {
            return
        }

        setFile(null)
        setPreview('')
        setImageUrl('')
        setAlt('')
        setCaption('')
        setError('')
        setUploading(false)
    }, [open])

    useEffect(() => {
        return () => {
            if (
                preview.startsWith(
                    'blob:'
                )
            ) {
                URL.revokeObjectURL(
                    preview
                )
            }
        }
    }, [preview])

    const selectFile = (
        selectedFile: File
    ) => {
        if (
            !selectedFile.type.startsWith(
                'image/'
            )
        ) {
            setError(
                'Please select an image file.'
            )

            return
        }

        if (
            preview.startsWith('blob:')
        ) {
            URL.revokeObjectURL(
                preview
            )
        }

        setFile(selectedFile)

        setPreview(
            URL.createObjectURL(
                selectedFile
            )
        )

        setError('')
    }

    const handleDrop = (
        event:
            DragEvent<HTMLDivElement>
    ) => {
        event.preventDefault()

        const selectedFile =
            event.dataTransfer.files?.[0]

        if (selectedFile) {
            selectFile(
                selectedFile
            )
        }
    }

    const handleUrlChange = (
        value: string
    ) => {
        setImageUrl(value)

        if (!file) {
            setPreview(
                value.trim()
            )
        }

        setError('')
    }

    const handleInsert =
    async () => {
        try {
            setError('')

            let src =
                imageUrl.trim()

            let storagePath =
                ''

            /*
            |--------------------------------------------------------------------------
            | Uploaded image
            |--------------------------------------------------------------------------
            */

            if (file) {
                setUploading(true)

                const result =
                    await uploadImage(
                        file
                    )

                src =
                    result.url

                storagePath =
                    result.path ??
                    ''
            }

            /*
            |--------------------------------------------------------------------------
            | Validate final image source
            |--------------------------------------------------------------------------
            */

            if (!src) {
                setError(
                    'Please upload an image or enter an image URL.'
                )

                return
            }

            /*
            |--------------------------------------------------------------------------
            | Insert image node
            |--------------------------------------------------------------------------
            */

            editor
                .chain()
                .focus()
                .insertImageFigure({
                    src,

                    path:
                        storagePath,

                    alt:
                        alt.trim(),

                    caption:
                        caption.trim(),

                    align:
                        'center',

                    width:
                        100,
                })
                .run()

            onClose()
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : 'Image upload failed.'
            )
        } finally {
            setUploading(
                false
            )
        }
    }

    return (
        <Dialog
            open={open}
            onClose={
                uploading
                    ? () => {}
                    : onClose
            }
            title="Insert Image"
            description="Drag & drop an image, browse from your device, or paste an image URL."
        >
            <div className="mw-dialog-body">
                <div className="mw-image-dialog-grid">
                    <div>
                        <div
                            className="mw-image-dropzone"
                            onDragOver={(
                                event
                            ) =>
                                event.preventDefault()
                            }
                            onDrop={
                                handleDrop
                            }
                            onClick={() =>
                                fileInputRef
                                    .current
                                    ?.click()
                            }
                        >
                            <input
                                ref={
                                    fileInputRef
                                }
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                hidden
                                onChange={(
                                    event
                                ) => {
                                    const selectedFile =
                                        event
                                            .target
                                            .files?.[0]

                                    if (
                                        selectedFile
                                    ) {
                                        selectFile(
                                            selectedFile
                                        )
                                    }
                                }}
                            />

                            <strong>
                                Drag & Drop
                            </strong>

                            <span>
                                your image here
                            </span>

                            <button
                                type="button"
                                className="mw-image-browse"
                            >
                                Browse
                            </button>
                        </div>
                    </div>

                    <div className="mw-image-preview-panel">
                        <strong>
                            Preview
                        </strong>

                        <div className="mw-image-preview">
                            {preview ? (
                                <img
                                    src={
                                        preview
                                    }
                                    alt=""
                                />
                            ) : (
                                <span>
                                    No image selected
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mw-form-group">
                    <label
                        className="mw-form-label"
                        htmlFor="mw-image-alt"
                    >
                        Alt text
                    </label>

                    <input
                        id="mw-image-alt"
                        type="text"
                        className="mw-form-input"
                        value={alt}
                        onChange={(
                            event
                        ) =>
                            setAlt(
                                event
                                    .target
                                    .value
                            )
                        }
                        placeholder="Describe the image for accessibility"
                    />
                </div>

                <div className="mw-form-group">
                    <label
                        className="mw-form-label"
                        htmlFor="mw-image-caption"
                    >
                        Caption
                        <span className="mw-form-optional">
                            {' '}
                            (optional)
                        </span>
                    </label>

                    <input
                        id="mw-image-caption"
                        type="text"
                        className="mw-form-input"
                        value={
                            caption
                        }
                        onChange={(
                            event
                        ) =>
                            setCaption(
                                event
                                    .target
                                    .value
                            )
                        }
                        placeholder="Write a caption"
                    />
                </div>

                <div className="mw-form-group">
                    <label
                        className="mw-form-label"
                        htmlFor="mw-image-url"
                    >
                        Image URL
                        <span className="mw-form-optional">
                            {' '}
                            (optional)
                        </span>
                    </label>

                    <input
                        id="mw-image-url"
                        type="url"
                        className="mw-form-input"
                        value={
                            imageUrl
                        }
                        onChange={(
                            event
                        ) =>
                            handleUrlChange(
                                event
                                    .target
                                    .value
                            )
                        }
                        placeholder="https://example.com/image.jpg"
                    />
                </div>

                {error && (
                    <p className="mw-form-error">
                        {error}
                    </p>
                )}
            </div>

            <div className="mw-dialog-footer">
                <div />

                <div className="mw-dialog-footer-actions">
                    <button
                        type="button"
                        className="mw-dialog-button"
                        disabled={
                            uploading
                        }
                        onClick={
                            onClose
                        }
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        className="mw-dialog-button mw-dialog-button-primary"
                        disabled={
                            uploading
                        }
                        onClick={
                            handleInsert
                        }
                    >
                        {uploading
                            ? 'Uploading...'
                            : 'Insert'}
                    </button>
                </div>
            </div>
        </Dialog>
    )
}