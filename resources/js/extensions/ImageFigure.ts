import {
    mergeAttributes,
    Node,
} from '@tiptap/core'

import {
    ReactNodeViewRenderer,
} from '@tiptap/react'

import ImageFigureView
    from '../components/nodeviews/ImageFigureView'

import type {
    ImageUploadResult,
} from '../types/media'

export type ImageAlignment =
    | 'left'
    | 'center'
    | 'right'

export interface ImageFigureOptions {
    imageUploadUrl:
        string

    onImageUpload?: (
        file: File
    ) => Promise<ImageUploadResult>
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        imageFigure: {
            insertImageFigure: (
                options: {
                    src: string

                    path?: string

                    alt?: string

                    caption?: string

                    align?:
                        ImageAlignment

                    width?:
                        number
                }
            ) => ReturnType
        }
    }
}

const ImageFigure =
    Node.create<ImageFigureOptions>({
        name:
            'imageFigure',

        group:
            'block',

        atom:
            true,

        draggable:
            true,

        selectable:
            true,

        isolating:
            true,

        addOptions() {
            return {
                imageUploadUrl:
                    '/tiptap-editor/media',

                onImageUpload:
                    undefined,
            }
        },

        addAttributes() {
            return {
                src: {
                    default:
                        '',
                },

                /*
                |--------------------------------------------------------------------------
                | Physical package-managed storage path
                |--------------------------------------------------------------------------
                |
                | Example:
                |
                | editor/tmp/abc.jpg
                |
                | Later:
                |
                | editor/images/news/55/abc.jpg
                |
                */

                storagePath: {
                    default:
                        '',
                },

                alt: {
                    default:
                        '',
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
                        'figure[data-mw-image]',

                    getAttrs:
                        (
                            element
                        ) => {
                            if (
                                !(
                                    element
                                    instanceof
                                    HTMLElement
                                )
                            ) {
                                return false
                            }

                            const image =
                                element.querySelector(
                                    'img'
                                )

                            if (
                                !image
                            ) {
                                return false
                            }

                            const caption =
                                element.querySelector(
                                    'figcaption'
                                )

                            return {
                                src:
                                    image.getAttribute(
                                        'src'
                                    ) ??
                                    '',

                                storagePath:
                                    element.getAttribute(
                                        'data-mw-path'
                                    ) ??
                                    '',

                                alt:
                                    image.getAttribute(
                                        'alt'
                                    ) ??
                                    '',

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
                storagePath,
                alt,
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
                    'data-mw-image':
                        '',

                    'data-mw-path':
                        storagePath ??
                        '',

                    'data-align':
                        currentAlign,

                    'data-width':
                        currentWidth,

                    'data-wrap':
                        shouldWrap
                            ? 'true'
                            : 'false',

                    class:
                        'mw-tiptap-image-figure',

                    style:
                        shouldWrap
                            ? `--mw-media-width: ${currentWidth}%;`
                            : undefined,
                })

            const image = [
                'img',

                {
                    src,

                    alt:
                        alt ??
                        '',

                    loading:
                        'lazy',

                    style:
                        shouldWrap
                            ? 'width: 100%;'
                            : `width: ${currentWidth}%;`,
                },
            ]

            if (
                caption
            ) {
                return [
                    'figure',

                    figureAttributes,

                    image,

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

                image,
            ]
        },

        addNodeView() {
            return ReactNodeViewRenderer(
                ImageFigureView
            )
        },

        addCommands() {
            return {
                insertImageFigure:
                    (
                        options
                    ) =>
                    ({
                        commands,
                    }) => {
                        return commands.insertContent(
                            {
                                type:
                                    this
                                        .name,

                                attrs:
                                    {
                                        src:
                                            options
                                                .src,

                                        storagePath:
                                            options
                                                .path ??
                                            '',

                                        alt:
                                            options
                                                .alt ??
                                            '',

                                        caption:
                                            options
                                                .caption ??
                                            '',

                                        align:
                                            options
                                                .align ??
                                            'center',

                                        width:
                                            options
                                                .width ??
                                            100,
                                    },
                            }
                        )
                    },
            }
        },
    })

export default ImageFigure