import {
    useImageUpload,
} from '../../hooks/useImageUpload'

import type {
    ImageFigureOptions,
} from '../../extensions/ImageFigure'

import {
    useEffect,
    useRef,
    useState,
} from 'react'

import type {
    NodeViewProps,
} from '@tiptap/react'

import {
    NodeViewWrapper,
} from '@tiptap/react'

type Alignment =
    | 'left'
    | 'center'
    | 'right'

type ResizeSide =
    | 'left'
    | 'right'

const MIN_IMAGE_WIDTH = 10
const MAX_IMAGE_WIDTH = 100

export default function ImageFigureView({
    node,
    selected,
    updateAttributes,
    deleteNode,
    extension,
}: NodeViewProps) {
    const {
        src,
        storagePath,
        alt,
        caption,
        align,
        width,
    } = node.attrs

    const wrapperRef =
        useRef<HTMLDivElement | null>(
            null
        )

    const replaceInputRef =
        useRef<HTMLInputElement | null>(
            null
        )

    const [
        replacing,
        setReplacing,
    ] = useState(
        false
    )

    const [
        replaceError,
        setReplaceError,
    ] = useState<
        string | null
    >(
        null
    )

    const imageOptions =
        extension.options as ImageFigureOptions

    const {
        uploadImage,
    } = useImageUpload({
        uploadUrl:
            imageOptions.imageUploadUrl,

        onImageUpload:
            imageOptions.onImageUpload,
    })

    const replaceImage =
    async (
        file: File
    ) => {
        if (
            !file.type.startsWith(
                'image/'
            )
        ) {
            setReplaceError(
                'Please select a valid image.'
            )

            return
        }

        setReplacing(
            true
        )

        setReplaceError(
            null
        )

        try {
            const result =
                await uploadImage(
                    file
                )

            /*
            |--------------------------------------------------------------------------
            | Only replace actual image source/path
            |--------------------------------------------------------------------------
            |
            | Keep:
            | - width
            | - alignment
            | - caption
            | - alt
            |
            */

            updateAttributes({
                src:
                    result.url,

                storagePath:
                    result.path ??
                    '',
            })
        } catch (
            error
        ) {
            setReplaceError(
                error instanceof
                    Error
                    ? error
                        .message
                    : 'Unable to replace image.'
            )
        } finally {
            setReplacing(
                false
            )

            if (
                replaceInputRef
                    .current
            ) {
                replaceInputRef
                    .current
                    .value =
                    ''
            }
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Live resize width
    |--------------------------------------------------------------------------
    |
    | liveWidth:
    | Used for React rendering.
    |
    | liveWidthRef:
    | Always contains the newest width during pointer movement.
    | This prevents React stale-state problems on pointerup.
    |
    */

    const initialWidth =
        Number(width) || 100

    const liveWidthRef =
        useRef(
            initialWidth
        )

    const [
        liveWidth,
        setLiveWidth,
    ] = useState(
        initialWidth
    )

    /*
    |--------------------------------------------------------------------------
    | Media wrapping
    |--------------------------------------------------------------------------
    */

    const currentAlignment:
        Alignment =
            align ??
            'center'

    const shouldWrap =
        currentAlignment !==
            'center' &&
        liveWidth < 100


    /*
    |--------------------------------------------------------------------------
    | Alt / Caption editing
    |--------------------------------------------------------------------------
    */

    const [
        editingAlt,
        setEditingAlt,
    ] = useState(false)

    const [
        editingCaption,
        setEditingCaption,
    ] = useState(false)

    const [
        altValue,
        setAltValue,
    ] = useState(
        alt ?? ''
    )

    const [
        captionValue,
        setCaptionValue,
    ] = useState(
        caption ?? ''
    )

    /*
    |--------------------------------------------------------------------------
    | Keep local values synchronized with Tiptap node attrs
    |--------------------------------------------------------------------------
    */

    useEffect(() => {
        setAltValue(
            alt ?? ''
        )
    }, [alt])

    useEffect(() => {
        setCaptionValue(
            caption ?? ''
        )
    }, [caption])

    useEffect(() => {
        const currentWidth =
            Number(width) || 100

        liveWidthRef.current =
            currentWidth

        setLiveWidth(
            currentWidth
        )
    }, [width])

    /*
    |--------------------------------------------------------------------------
    | Alignment
    |--------------------------------------------------------------------------
    */

    const setAlignment = (
        value: Alignment
    ) => {
        updateAttributes({
            align: value,
        })
    }

    /*
    |--------------------------------------------------------------------------
    | Save alt text
    |--------------------------------------------------------------------------
    */

    const saveAlt = () => {
        updateAttributes({
            alt:
                altValue.trim(),
        })

        setEditingAlt(
            false
        )
    }

    /*
    |--------------------------------------------------------------------------
    | Save caption
    |--------------------------------------------------------------------------
    */

    const saveCaption = () => {
        updateAttributes({
            caption:
                captionValue.trim(),
        })

        setEditingCaption(
            false
        )
    }

    /*
    |--------------------------------------------------------------------------
    | Drag resize
    |--------------------------------------------------------------------------
    */

    const startResize = (
        event:
            React.PointerEvent<HTMLDivElement>,
        side: ResizeSide
    ) => {
        event.preventDefault()
        event.stopPropagation()

        const wrapper =
            wrapperRef.current

        if (!wrapper) {
            return
        }

        /*
        |--------------------------------------------------------------------------
        | Width must be measured against the entire editor content area.
        |--------------------------------------------------------------------------
        */

        const editorContent =
            wrapper.closest(
                '.mw-tiptap-content'
            )

        const measurementElement =
            editorContent ??
            wrapper.parentElement

        if (!measurementElement) {
            return
        }

        const parentRect =
            measurementElement
                .getBoundingClientRect()

        if (
            parentRect.width <= 0
        ) {
            return
        }

        const startX =
            event.clientX

        const startWidth =
            liveWidthRef.current

        const handle =
            event.currentTarget

        const pointerId =
            event.pointerId

        handle.setPointerCapture(
            pointerId
        )

        document.body.classList.add(
            'mw-image-is-resizing'
        )

        /*
        |--------------------------------------------------------------------------
        | Pointer move
        |--------------------------------------------------------------------------
        */

        const onPointerMove = (
            moveEvent:
                PointerEvent
        ) => {
            const deltaX =
                moveEvent.clientX
                - startX

            const deltaPercent =
                (
                    deltaX
                    / parentRect.width
                )
                * 100

            let nextWidth =
                startWidth

            /*
            |--------------------------------------------------------------------------
            | Bottom-right
            |--------------------------------------------------------------------------
            |
            | Drag right  -> bigger
            | Drag left   -> smaller
            |
            */

            if (
                side ===
                'right'
            ) {
                nextWidth =
                    startWidth
                    + deltaPercent
            }

            /*
            |--------------------------------------------------------------------------
            | Bottom-left
            |--------------------------------------------------------------------------
            |
            | Drag left   -> bigger
            | Drag right  -> smaller
            |
            */

            if (
                side ===
                'left'
            ) {
                nextWidth =
                    startWidth
                    - deltaPercent
            }

            /*
            |--------------------------------------------------------------------------
            | Restrict image between 10% and 100%
            |--------------------------------------------------------------------------
            */

            nextWidth =
                Math.max(
                    MIN_IMAGE_WIDTH,
                    Math.min(
                        MAX_IMAGE_WIDTH,
                        nextWidth
                    )
                )

            const roundedWidth =
                Math.round(
                    nextWidth
                )

            /*
            |--------------------------------------------------------------------------
            | Update ref immediately
            |--------------------------------------------------------------------------
            */

            liveWidthRef.current =
                roundedWidth

            /*
            |--------------------------------------------------------------------------
            | Update visual width
            |--------------------------------------------------------------------------
            */

            setLiveWidth(
                roundedWidth
            )
        }

        /*
        |--------------------------------------------------------------------------
        | Pointer release
        |--------------------------------------------------------------------------
        */

        const finishResize = () => {
            const finalWidth =
                liveWidthRef.current

            /*
            |--------------------------------------------------------------------------
            | Save final exact width into Tiptap node
            |--------------------------------------------------------------------------
            */

            updateAttributes({
                width:
                    finalWidth,
            })

            document.body.classList.remove(
                'mw-image-is-resizing'
            )

            window.removeEventListener(
                'pointermove',
                onPointerMove
            )

            window.removeEventListener(
                'pointerup',
                onPointerUp
            )

            window.removeEventListener(
                'pointercancel',
                onPointerCancel
            )
        }

        const onPointerUp = (
            upEvent:
                PointerEvent
        ) => {
            try {
                if (
                    handle.hasPointerCapture(
                        upEvent.pointerId
                    )
                ) {
                    handle.releasePointerCapture(
                        upEvent.pointerId
                    )
                }
            } catch {
                //
            }

            finishResize()
        }

        const onPointerCancel = (
            cancelEvent:
                PointerEvent
        ) => {
            try {
                if (
                    handle.hasPointerCapture(
                        cancelEvent.pointerId
                    )
                ) {
                    handle.releasePointerCapture(
                        cancelEvent.pointerId
                    )
                }
            } catch {
                //
            }

            finishResize()
        }

        window.addEventListener(
            'pointermove',
            onPointerMove
        )

        window.addEventListener(
            'pointerup',
            onPointerUp
        )

        window.addEventListener(
            'pointercancel',
            onPointerCancel
        )
    }

    /*
    |--------------------------------------------------------------------------
    | Render
    |--------------------------------------------------------------------------
    */

    return (
        <NodeViewWrapper
            className={[
                'mw-image-node',

                selected
                    ? 'is-selected'
                    : '',

                `is-align-${
                    currentAlignment
                }`,

                shouldWrap
                    ? 'is-wrapped'
                    : 'is-block',
            ]
                .filter(Boolean)
                .join(' ')}
            style={
                shouldWrap
                    ? {
                        width:
                            `${liveWidth}%`,
                    }
                    : undefined
            }
        >
            {/*
            |--------------------------------------------------------------------------
            | Floating image toolbar
            |--------------------------------------------------------------------------
            */}

            {selected && (
                <div
                    className="mw-image-node-toolbar"
                    contentEditable={
                        false
                    }
                >
                    {/*
                    |--------------------------------------------------------------------------
                    | Alignment
                    |--------------------------------------------------------------------------
                    */}

                    <div className="mw-image-node-toolbar-group">
                        <button
                            type="button"
                            className={
                                align ===
                                'left'
                                    ? 'is-active'
                                    : ''
                            }
                            title="Align left"
                            onClick={() =>
                                setAlignment(
                                    'left'
                                )
                            }
                        >
                            ⇤
                        </button>

                        <button
                            type="button"
                            className={
                                align ===
                                'center'
                                    ? 'is-active'
                                    : ''
                            }
                            title="Align center"
                            onClick={() =>
                                setAlignment(
                                    'center'
                                )
                            }
                        >
                            ↔
                        </button>

                        <button
                            type="button"
                            className={
                                align ===
                                'right'
                                    ? 'is-active'
                                    : ''
                            }
                            title="Align right"
                            onClick={() =>
                                setAlignment(
                                    'right'
                                )
                            }
                        >
                            ⇥
                        </button>
                    </div>

                    <div className="mw-image-node-divider" />

                    {/*
                    |--------------------------------------------------------------------------
                    | Live width indicator
                    |--------------------------------------------------------------------------
                    */}

                    <span
                        className="mw-image-size-label"
                        title="Image width"
                    >
                        {Math.round(
                            liveWidth
                        )}
                        %
                    </span>

                    <div className="mw-image-node-divider" />

                    {/*
                    |--------------------------------------------------------------------------
                    | Replace Image
                    |--------------------------------------------------------------------------
                    */}

                    <button
                        type="button"
                        title="Replace image"
                        disabled={
                            replacing
                        }
                        onClick={() =>
                            replaceInputRef
                                .current
                                ?.click()
                        }
                    >
                        {replacing
                            ? 'Replacing…'
                            : 'Replace'}
                    </button>

                    <input
                        ref={
                            replaceInputRef
                        }
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        hidden
                        onChange={(
                            event
                        ) => {
                            const file =
                                event
                                    .target
                                    .files?.[0]

                            if (file) {
                                void replaceImage(
                                    file
                                )
                            }
                        }}
                    />

                    <div className="mw-image-node-divider" />

                    {/*
                    |--------------------------------------------------------------------------
                    | Alt
                    |--------------------------------------------------------------------------
                    */}

                    <button
                        type="button"
                        className={
                            editingAlt
                                ? 'is-active'
                                : ''
                        }
                        title="Edit alt text"
                        onClick={() => {
                            setEditingAlt(
                                (
                                    current
                                ) =>
                                    !current
                            )

                            setEditingCaption(
                                false
                            )
                        }}
                    >
                        ALT
                    </button>

                    {/*
                    |--------------------------------------------------------------------------
                    | Caption
                    |--------------------------------------------------------------------------
                    */}

                    <button
                        type="button"
                        className={
                            editingCaption
                                ? 'is-active'
                                : ''
                        }
                        title="Edit caption"
                        onClick={() => {
                            setEditingCaption(
                                (
                                    current
                                ) =>
                                    !current
                            )

                            setEditingAlt(
                                false
                            )
                        }}
                    >
                        Caption
                    </button>

                    <div className="mw-image-node-divider" />

                    {/*
                    |--------------------------------------------------------------------------
                    | Delete
                    |--------------------------------------------------------------------------
                    */}

                    <button
                        type="button"
                        className="mw-image-delete-button"
                        title="Delete image"
                        onClick={
                            deleteNode
                        }
                    >
                        ×
                    </button>
                </div>
            )}

            {/*
            |--------------------------------------------------------------------------
            | Replace Error
            |--------------------------------------------------------------------------
            */}

            {selected &&
                replaceError && (
                    <div
                        className="mw-image-replace-error"
                        contentEditable={
                            false
                        }
                    >
                        {replaceError}
                    </div>
                )}

            {/*
            |--------------------------------------------------------------------------
            | Image container
            |--------------------------------------------------------------------------
            */}

            <div
                ref={
                    wrapperRef
                }
                className="mw-image-node-inner"
                style={{
                    width:
                        shouldWrap
                            ? '100%'
                            : `${liveWidth}%`,
                }}
            >
                <img
                    src={src}
                    alt={alt ?? ''}
                    draggable={
                        false
                    }
                />

                {/*
                |--------------------------------------------------------------------------
                | Resize handles
                |--------------------------------------------------------------------------
                */}

                {selected && (
                    <>
                        <div
                            className="
                                mw-image-resize-handle
                                mw-image-resize-handle-bottom-left
                            "
                            contentEditable={
                                false
                            }
                            title="Resize image"
                            onPointerDown={(
                                event
                            ) =>
                                startResize(
                                    event,
                                    'left'
                                )
                            }
                        />

                        <div
                            className="
                                mw-image-resize-handle
                                mw-image-resize-handle-bottom-right
                            "
                            contentEditable={
                                false
                            }
                            title="Resize image"
                            onPointerDown={(
                                event
                            ) =>
                                startResize(
                                    event,
                                    'right'
                                )
                            }
                        />
                    </>
                )}

                {/*
                |--------------------------------------------------------------------------
                | Caption
                |--------------------------------------------------------------------------
                */}

                {caption && (
                    <figcaption className="mw-image-node-caption">
                        {caption}
                    </figcaption>
                )}
            </div>

            {/*
            |--------------------------------------------------------------------------
            | Alt editor
            |--------------------------------------------------------------------------
            */}

            {selected &&
                editingAlt && (
                    <div
                        className="mw-image-node-editor"
                        contentEditable={
                            false
                        }
                    >
                        <label>
                            Alt text
                        </label>

                        <div className="mw-image-node-editor-row">
                            <input
                                type="text"
                                value={
                                    altValue
                                }
                                onChange={(
                                    event
                                ) =>
                                    setAltValue(
                                        event
                                            .target
                                            .value
                                    )
                                }
                                onKeyDown={(
                                    event
                                ) => {
                                    if (
                                        event.key ===
                                        'Enter'
                                    ) {
                                        event.preventDefault()

                                        saveAlt()
                                    }
                                }}
                                placeholder="Describe this image"
                            />

                            <button
                                type="button"
                                onClick={
                                    saveAlt
                                }
                            >
                                Save
                            </button>
                        </div>
                    </div>
                )}

            {/*
            |--------------------------------------------------------------------------
            | Caption editor
            |--------------------------------------------------------------------------
            */}

            {selected &&
                editingCaption && (
                    <div
                        className="mw-image-node-editor"
                        contentEditable={
                            false
                        }
                    >
                        <label>
                            Caption
                        </label>

                        <div className="mw-image-node-editor-row">
                            <input
                                type="text"
                                value={
                                    captionValue
                                }
                                onChange={(
                                    event
                                ) =>
                                    setCaptionValue(
                                        event
                                            .target
                                            .value
                                    )
                                }
                                onKeyDown={(
                                    event
                                ) => {
                                    if (
                                        event.key ===
                                        'Enter'
                                    ) {
                                        event.preventDefault()

                                        saveCaption()
                                    }
                                }}
                                placeholder="Image caption"
                            />

                            <button
                                type="button"
                                onClick={
                                    saveCaption
                                }
                            >
                                Save
                            </button>
                        </div>
                    </div>
                )}
        </NodeViewWrapper>
    )
}