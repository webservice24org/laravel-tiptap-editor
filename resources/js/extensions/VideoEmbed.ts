import {
    mergeAttributes,
    Node,
} from '@tiptap/core'

import {
    ReactNodeViewRenderer,
} from '@tiptap/react'

import VideoEmbedView
    from '../components/nodeviews/VideoEmbedView'

export type VideoProvider =
    | 'youtube'
    | 'vimeo'

export type VideoAlignment =
    | 'left'
    | 'center'
    | 'right'

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        videoEmbed: {
            insertVideoEmbed: (
                options: {
                    src: string
                    provider: VideoProvider
                    caption?: string
                    align?: VideoAlignment
                    width?: number
                }
            ) => ReturnType
        }
    }
}

const VideoEmbed =
    Node.create({
        name:
            'videoEmbed',

        group:
            'block',

        atom:
            true,

        selectable:
            true,

        draggable:
            true,

        isolating:
            true,

        addAttributes() {
            return {
                src: {
                    default:
                        '',
                },

                provider: {
                    default:
                        'youtube',
                },

                caption: {
                    default:
                        '',
                },

                align: {
                    default:
                        'center',

                    parseHTML:
                        (
                            element
                        ) =>
                            element.getAttribute(
                                'data-align'
                            ) ??
                            'center',
                },

                width: {
                    default:
                        100,

                    parseHTML:
                        (
                            element
                        ) => {
                            const value =
                                element.getAttribute(
                                    'data-width'
                                )

                            return value
                                ? Number(
                                      value
                                  )
                                : 100
                        },
                },
            }
        },

        parseHTML() {
            return [
                {
                    tag:
                        'figure[data-mw-video]',

                    getAttrs:
                        (
                            element
                        ) => {
                            if (
                                !(
                                    element instanceof
                                    HTMLElement
                                )
                            ) {
                                return false
                            }

                            const iframe =
                                element.querySelector(
                                    'iframe'
                                )

                            if (!iframe) {
                                return false
                            }

                            const caption =
                                element.querySelector(
                                    'figcaption'
                                )

                            return {
                                src:
                                    iframe.getAttribute(
                                        'src'
                                    ) ??
                                    '',

                                provider:
                                    element.getAttribute(
                                        'data-provider'
                                    ) ??
                                    'youtube',

                                caption:
                                    caption
                                        ?.textContent
                                        ?.trim() ??
                                    '',

                                align:
                                    element.getAttribute(
                                        'data-align'
                                    ) ??
                                    'center',

                                width:
                                    Number(
                                        element.getAttribute(
                                            'data-width'
                                        )
                                    ) ||
                                    100,
                            }
                        },
                },
            ]
        },

        renderHTML({
    HTMLAttributes,
}) {
    const {
        src,
        provider,
        caption,
        align,
        width,
    } =
        HTMLAttributes

    const currentAlign =
        align ??
        'center'

    const currentWidth =
        Number(width) ||
        100

    const shouldWrap =
        currentAlign !==
            'center' &&
        currentWidth < 100

    const figureAttributes =
        mergeAttributes({
            'data-mw-video':
                '',

            'data-provider':
                provider ??
                'youtube',

            'data-align':
                currentAlign,

            'data-width':
                currentWidth,

            'data-wrap':
                shouldWrap
                    ? 'true'
                    : 'false',

            class:
                'mw-tiptap-video-figure',

            style:
                shouldWrap
                    ? `--mw-media-width: ${currentWidth}%;`
                    : undefined,
        })

    const iframe = [
        'iframe',

        {
            src,

            loading:
                'lazy',

            allow:
                'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',

            allowfullscreen:
                'true',

            referrerpolicy:
                'strict-origin-when-cross-origin',
        },
    ]

    const videoWrapper = [
        'div',

        {
            class:
                'mw-tiptap-video-frame',

            style:
                shouldWrap
                    ? 'width: 100%;'
                    : `width: ${currentWidth}%;`,
        },

        iframe,
    ]

    if (caption) {
        return [
            'figure',

            figureAttributes,

            videoWrapper,

            [
                'figcaption',
                {},
                caption,
            ],
        ]
    }

    return [
        'figure',

        figureAttributes,

        videoWrapper,
    ]
},

        addNodeView() {
            return ReactNodeViewRenderer(
                VideoEmbedView
            )
        },

        addCommands() {
            return {
                insertVideoEmbed:
                    (
                        options
                    ) =>
                    ({
                        commands,
                    }) => {
                        return commands.insertContent(
                            {
                                type:
                                    this.name,

                                attrs: {
                                    src:
                                        options.src,

                                    provider:
                                        options.provider,

                                    caption:
                                        options.caption ??
                                        '',

                                    align:
                                        options.align ??
                                        'center',

                                    width:
                                        options.width ??
                                        100,
                                },
                            }
                        )
                    },
            }
        },
    })

export default VideoEmbed