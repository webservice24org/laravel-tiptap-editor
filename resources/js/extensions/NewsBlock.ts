import {
    mergeAttributes,
    Node,
} from '@tiptap/core'

import {
    ReactNodeViewRenderer,
} from '@tiptap/react'

import NewsBlockView
    from '../components/nodeviews/NewsBlockView'

import type {
    NewsBlockStyle,
} from '../types/newsBlock'

export interface InsertNewsBlockOptions {
    newsId?: string | number
    title: string
    url: string
    thumbnail?: string
    category?: string
    excerpt?: string
    style?: NewsBlockStyle
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        newsBlock: {
            insertNewsBlock:
                (
                    options:
                        InsertNewsBlockOptions
                ) => ReturnType
        }
    }
}

const NewsBlock =
    Node.create({
        name:
            'newsBlock',

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
                newsId: {
                    default:
                        null,

                    parseHTML:
                        (
                            element
                        ) =>
                            element.getAttribute(
                                'data-news-id'
                            ),

                    renderHTML:
                        (
                            attributes
                        ) =>
                            attributes.newsId
                                ? {
                                      'data-news-id':
                                          String(
                                              attributes.newsId
                                          ),
                                  }
                                : {},
                },

                title: {
                    default:
                        '',

                    parseHTML:
                        (
                            element
                        ) =>
                            element.getAttribute(
                                'data-title'
                            ) ??
                            element
                                .querySelector(
                                    '[data-mw-news-title]'
                                )
                                ?.textContent ??
                            '',
                },

                url: {
                    default:
                        '',

                    parseHTML:
                        (
                            element
                        ) =>
                            element.getAttribute(
                                'data-url'
                            ) ??
                            element
                                .querySelector(
                                    'a'
                                )
                                ?.getAttribute(
                                    'href'
                                ) ??
                            '',
                },

                thumbnail: {
                    default:
                        '',

                    parseHTML:
                        (
                            element
                        ) =>
                            element.getAttribute(
                                'data-thumbnail'
                            ) ??
                            element
                                .querySelector(
                                    'img'
                                )
                                ?.getAttribute(
                                    'src'
                                ) ??
                            '',
                },

                category: {
                    default:
                        '',

                    parseHTML:
                        (
                            element
                        ) =>
                            element.getAttribute(
                                'data-category'
                            ) ??
                            element
                                .querySelector(
                                    '[data-mw-news-category]'
                                )
                                ?.textContent ??
                            '',
                },

                excerpt: {
                    default:
                        '',

                    parseHTML:
                        (
                            element
                        ) =>
                            element.getAttribute(
                                'data-excerpt'
                            ) ??
                            element
                                .querySelector(
                                    '[data-mw-news-excerpt]'
                                )
                                ?.textContent ??
                            '',
                },

                style: {
                    default:
                        'card',

                    parseHTML:
                        (
                            element
                        ) => {
                            const value =
                                element.getAttribute(
                                    'data-style'
                                )

                            if (
                                value ===
                                    'compact' ||
                                value ===
                                    'featured'
                            ) {
                                return value
                            }

                            return 'card'
                        },
                },
            }
        },

        parseHTML() {
            return [
                {
                    tag:
                        'article[data-mw-news-block]',
                },
            ]
        },

        renderHTML({
            HTMLAttributes,
        }) {
            const {
                newsId,
                title,
                url,
                thumbnail,
                category,
                excerpt,
                style,
                ...rest
            } =
                HTMLAttributes

            const safeTitle =
                String(
                    title ??
                    ''
                )

            const safeUrl =
                String(
                    url ??
                    ''
                )

            const safeThumbnail =
                String(
                    thumbnail ??
                    ''
                )

            const safeCategory =
                String(
                    category ??
                    ''
                )

            const safeExcerpt =
                String(
                    excerpt ??
                    ''
                )

            const safeStyle:
                NewsBlockStyle =
                    style ===
                        'compact' ||
                    style ===
                        'featured'
                        ? style
                        : 'card'

            const articleAttributes =
                mergeAttributes(
                    rest,
                    {
                        'data-mw-news-block':
                            'true',

                        'data-news-id':
                            newsId
                                ? String(
                                      newsId
                                  )
                                : undefined,

                        'data-title':
                            safeTitle,

                        'data-url':
                            safeUrl,

                        'data-thumbnail':
                            safeThumbnail,

                        'data-category':
                            safeCategory,

                        'data-excerpt':
                            safeExcerpt,

                        'data-style':
                            safeStyle,

                        class:
                            `mw-news-block mw-news-block-${safeStyle}`,
                    }
                )

            const children:
                unknown[] =
                    []

            if (
                safeThumbnail
            ) {
                children.push(
                    [
                        'div',
                        {
                            class:
                                'mw-news-block-media',
                        },
                        [
                            'img',
                            {
                                src:
                                    safeThumbnail,

                                alt:
                                    '',

                                loading:
                                    'lazy',

                                decoding:
                                    'async',
                            },
                        ],
                    ]
                )
            }

            const content:
                unknown[] =
                    []

            if (
                safeCategory
            ) {
                content.push(
                    [
                        'span',
                        {
                            'data-mw-news-category':
                                'true',

                            class:
                                'mw-news-block-category',
                        },
                        safeCategory,
                    ]
                )
            }

            content.push(
                [
                    'h3',
                    {
                        'data-mw-news-title':
                            'true',

                        class:
                            'mw-news-block-title',
                    },
                    safeTitle,
                ]
            )

            if (
                safeExcerpt
            ) {
                content.push(
                    [
                        'p',
                        {
                            'data-mw-news-excerpt':
                                'true',

                            class:
                                'mw-news-block-excerpt',
                        },
                        safeExcerpt,
                    ]
                )
            }

            children.push(
                [
                    'div',
                    {
                        class:
                            'mw-news-block-content',
                    },
                    ...content,
                ]
            )

            return [
                'article',
                articleAttributes,

                [
                    'a',
                    {
                        href:
                            safeUrl,

                        class:
                            'mw-news-block-link',
                    },
                    ...children,
                ],
            ]
        },

        addNodeView() {
            return ReactNodeViewRenderer(
                NewsBlockView
            )
        },

        addCommands() {
            return {
                insertNewsBlock:
                    (
                        options
                    ) =>
                    ({
                        commands,
                    }) =>
                        commands.insertContent(
                            {
                                type:
                                    this.name,

                                attrs: {
                                    newsId:
                                        options.newsId ??
                                        null,

                                    title:
                                        options.title,

                                    url:
                                        options.url,

                                    thumbnail:
                                        options.thumbnail ??
                                        '',

                                    category:
                                        options.category ??
                                        '',

                                    excerpt:
                                        options.excerpt ??
                                        '',

                                    style:
                                        options.style ??
                                        'card',
                                },
                            }
                        ),
            }
        },
    })

export default NewsBlock
