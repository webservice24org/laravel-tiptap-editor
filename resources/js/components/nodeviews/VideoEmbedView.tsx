import {
    useEffect,
    useState,
} from 'react'

import type {
    NodeViewProps,
} from '@tiptap/react'

import {
    NodeViewWrapper,
} from '@tiptap/react'

import {
    parseVideoUrl,
} from '../../utils/video'

type Alignment =
    | 'left'
    | 'center'
    | 'right'

const VIDEO_WIDTHS = [
    50,
    75,
    100,
] as const

export default function VideoEmbedView({
    editor,
    node,
    selected,
    updateAttributes,
    deleteNode,
    getPos,
}: NodeViewProps) {
    const {
        src,
        caption,
        align,
        width,
    } = node.attrs

    const [
        editingUrl,
        setEditingUrl,
    ] = useState(
        false
    )

    const [
        editingCaption,
        setEditingCaption,
    ] = useState(
        false
    )

    const [
        urlValue,
        setUrlValue,
    ] = useState(
        src ?? ''
    )

    const [
        captionValue,
        setCaptionValue,
    ] = useState(
        caption ?? ''
    )

    const [
        error,
        setError,
    ] = useState(
        ''
    )

    /*
    |--------------------------------------------------------------------------
    | Current values
    |--------------------------------------------------------------------------
    */

    const currentAlignment:
        Alignment =
            align ??
            'center'

    const currentWidth =
        Number(
            width
        ) ||
        100

    const shouldWrap =
        currentAlignment !==
            'center' &&
        currentWidth < 100

    /*
    |--------------------------------------------------------------------------
    | Keep local values synchronized
    |--------------------------------------------------------------------------
    */

    useEffect(() => {
        setUrlValue(
            src ?? ''
        )
    }, [src])

    useEffect(() => {
        setCaptionValue(
            caption ?? ''
        )
    }, [caption])

    /*
    |--------------------------------------------------------------------------
    | Alignment
    |--------------------------------------------------------------------------
    */

    const setAlignment = (
        value:
            Alignment
    ) => {
        updateAttributes({
            align:
                value,
        })
    }

    /*
    |--------------------------------------------------------------------------
    | Width
    |--------------------------------------------------------------------------
    */

    const setWidth = (
        value:
            number
    ) => {
        updateAttributes({
            width:
                value,
        })
    }

    /*
    |--------------------------------------------------------------------------
    | Save URL
    |--------------------------------------------------------------------------
    */

    const saveUrl =
        () => {
            setError(
                ''
            )

            const parsed =
                parseVideoUrl(
                    urlValue
                )

            if (
                !parsed
            ) {
                setError(
                    'Please enter a valid YouTube or Vimeo URL.'
                )

                return
            }

            updateAttributes({
                src:
                    parsed.embedUrl,

                provider:
                    parsed.provider,
            })

            setEditingUrl(
                false
            )
        }

    /*
    |--------------------------------------------------------------------------
    | Save caption
    |--------------------------------------------------------------------------
    */

    const saveCaption =
        () => {
            updateAttributes({
                caption:
                    captionValue
                        .trim(),
            })

            setEditingCaption(
                false
            )
        }

    /*
    |--------------------------------------------------------------------------
    | Select video node
    |--------------------------------------------------------------------------
    |
    | An iframe owns its own browsing context, so clicking directly on the
    | iframe does not reliably select the ProseMirror node. The transparent
    | editor overlay below forwards that click into a node selection.
    |
    */

    const selectVideoNode = () => {
        const position =
            typeof getPos === 'function'
                ? getPos()
                : undefined

        if (
            typeof position !==
            'number'
        ) {
            return
        }

        editor
            .chain()
            .focus()
            .setNodeSelection(
                position
            )
            .run()
    }

    /*
    |--------------------------------------------------------------------------
    | Render
    |--------------------------------------------------------------------------
    */

    return (
        <NodeViewWrapper
            className={[
                'mw-video-node',

                selected
                    ? 'is-selected'
                    : '',

                `is-align-${currentAlignment}`,

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
                            `${currentWidth}%`,
                    }
                    : undefined
            }
        >
            {/*
            |--------------------------------------------------------------------------
            | Floating Toolbar
            |--------------------------------------------------------------------------
            */}

            {selected && (
                <div
                    className="mw-video-node-toolbar"
                    contentEditable={
                        false
                    }
                >
                    {/*
                    |--------------------------------------------------------------------------
                    | Alignment
                    |--------------------------------------------------------------------------
                    */}

                    <div className="mw-video-node-toolbar-group">
                        <button
                            type="button"
                            className={
                                currentAlignment ===
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
                                currentAlignment ===
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
                                currentAlignment ===
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

                    <div className="mw-video-node-divider" />

                    {/*
                    |--------------------------------------------------------------------------
                    | Width
                    |--------------------------------------------------------------------------
                    */}

                    <div className="mw-video-node-toolbar-group">
                        {VIDEO_WIDTHS.map(
                            (
                                videoWidth
                            ) => (
                                <button
                                    key={
                                        videoWidth
                                    }
                                    type="button"
                                    className={
                                        currentWidth ===
                                        videoWidth
                                            ? 'is-active'
                                            : ''
                                    }
                                    title={`Set width to ${videoWidth}%`}
                                    onClick={() =>
                                        setWidth(
                                            videoWidth
                                        )
                                    }
                                >
                                    {
                                        videoWidth
                                    }
                                    %
                                </button>
                            )
                        )}
                    </div>

                    <div className="mw-video-node-divider" />

                    {/*
                    |--------------------------------------------------------------------------
                    | Edit URL
                    |--------------------------------------------------------------------------
                    */}

                    <button
                        type="button"
                        className={
                            editingUrl
                                ? 'is-active'
                                : ''
                        }
                        onClick={() => {
                            setEditingUrl(
                                (
                                    current
                                ) =>
                                    !current
                            )

                            setEditingCaption(
                                false
                            )

                            setError(
                                ''
                            )
                        }}
                    >
                        Edit URL
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
                        onClick={() => {
                            setEditingCaption(
                                (
                                    current
                                ) =>
                                    !current
                            )

                            setEditingUrl(
                                false
                            )

                            setError(
                                ''
                            )
                        }}
                    >
                        Caption
                    </button>

                    <div className="mw-video-node-divider" />

                    {/*
                    |--------------------------------------------------------------------------
                    | Delete
                    |--------------------------------------------------------------------------
                    */}

                    <button
                        type="button"
                        className="mw-video-delete-button"
                        title="Delete video"
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
            | URL Editor
            |--------------------------------------------------------------------------
            */}

            {selected &&
                editingUrl && (
                    <div
                        className="mw-video-node-editor"
                        contentEditable={
                            false
                        }
                    >
                        <label>
                            Video URL
                        </label>

                        <div className="mw-video-node-editor-row">
                            <input
                                type="url"
                                value={
                                    urlValue
                                }
                                onChange={(
                                    event
                                ) => {
                                    setUrlValue(
                                        event
                                            .target
                                            .value
                                    )

                                    setError(
                                        ''
                                    )
                                }}
                                onKeyDown={(
                                    event
                                ) => {
                                    if (
                                        event.key ===
                                        'Enter'
                                    ) {
                                        event.preventDefault()

                                        saveUrl()
                                    }
                                }}
                                placeholder="YouTube or Vimeo URL"
                            />

                            <button
                                type="button"
                                onClick={
                                    saveUrl
                                }
                            >
                                Save
                            </button>
                        </div>

                        {error && (
                            <p className="mw-video-node-error">
                                {error}
                            </p>
                        )}
                    </div>
                )}

            {/*
            |--------------------------------------------------------------------------
            | Caption Editor
            |--------------------------------------------------------------------------
            */}

            {selected &&
                editingCaption && (
                    <div
                        className="mw-video-node-editor"
                        contentEditable={
                            false
                        }
                    >
                        <label>
                            Caption
                        </label>

                        <div className="mw-video-node-editor-row">
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
                                placeholder="Video caption"
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

            {/*
            |--------------------------------------------------------------------------
            | Video
            |--------------------------------------------------------------------------
            */}

            <div
                className="mw-video-node-inner"
                style={{
                    width:
                        shouldWrap
                            ? '100%'
                            : `${currentWidth}%`,
                }}
            >
                <figure
                    className="mw-tiptap-video-figure"
                    data-mw-video=""
                    data-provider={
                        node.attrs
                            .provider
                    }
                    data-align={
                        currentAlignment
                    }
                    data-width={
                        currentWidth
                    }
                >
                    <div className="mw-tiptap-video-frame">
                        <button
                            type="button"
                            className="mw-video-node-selection-overlay"
                            contentEditable={
                                false
                            }
                            aria-label="Select video"
                            title="Select video"
                            onMouseDown={(
                                event
                            ) => {
                                event.preventDefault()
                                event.stopPropagation()

                                selectVideoNode()
                            }}
                        />

                        <iframe
                            src={
                                src
                            }
                            title="Embedded video"
                            loading="lazy"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                        />
                    </div>

                    {caption && (
                        <figcaption>
                            {
                                caption
                            }
                        </figcaption>
                    )}
                </figure>
            </div>
        </NodeViewWrapper>
    )
}