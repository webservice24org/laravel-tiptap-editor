import {
    useState,
} from 'react'

import {
    NodeViewWrapper,
} from '@tiptap/react'

import type {
    NodeViewProps,
} from '@tiptap/react'

import NewsBlockDialog
    from '../dialogs/NewsBlockDialog'

import type {
    NewsBlockData,
    NewsBlockStyle,
} from '../../types/newsBlock'

export default function NewsBlockView({
    editor,
    node,
    selected,
    updateAttributes,
    deleteNode,
}: NodeViewProps) {
    const [
        editOpen,
        setEditOpen,
    ] =
        useState(false)

    const data:
        NewsBlockData = {
            id:
                node.attrs.newsId,

            title:
                node.attrs.title ??
                '',

            url:
                node.attrs.url ??
                '',

            thumbnail:
                node.attrs.thumbnail ??
                '',

            category:
                node.attrs.category ??
                '',

            excerpt:
                node.attrs.excerpt ??
                '',

            style:
                (
                    node.attrs.style ??
                    'card'
                ) as NewsBlockStyle,
        }

    const handleUpdate = (
        next:
            NewsBlockData
    ) => {
        updateAttributes({
            newsId:
                next.id ??
                null,

            title:
                next.title,

            url:
                next.url,

            thumbnail:
                next.thumbnail ??
                '',

            category:
                next.category ??
                '',

            excerpt:
                next.excerpt ??
                '',

            style:
                next.style ??
                'card',
        })
    }

    return (
        <NodeViewWrapper
            className={[
                'mw-news-node',
                selected
                    ? 'is-selected'
                    : '',
            ]
                .filter(Boolean)
                .join(' ')}
            data-drag-handle
        >
            {selected && (
                <div
                    className="mw-news-node-toolbar"
                    contentEditable={
                        false
                    }
                >
                    <button
                        type="button"
                        onClick={() =>
                            setEditOpen(
                                true
                            )
                        }
                    >
                        Edit
                    </button>

                    <button
                        type="button"
                        className="mw-news-node-danger"
                        onClick={() =>
                            deleteNode()
                        }
                    >
                        Delete
                    </button>
                </div>
            )}

            <article
                className={`mw-news-block mw-news-block-${data.style ?? 'card'}`}
            >
                <a
                    href={
                        data.url
                    }
                    className="mw-news-block-link"
                    onClick={(
                        event
                    ) =>
                        event.preventDefault()
                    }
                >
                    {data.thumbnail && (
                        <div className="mw-news-block-media">
                            <img
                                src={
                                    data.thumbnail
                                }
                                alt=""
                                loading="lazy"
                                decoding="async"
                            />
                        </div>
                    )}

                    <div className="mw-news-block-content">
                        {data.category && (
                            <span className="mw-news-block-category">
                                {
                                    data.category
                                }
                            </span>
                        )}

                        <h3 className="mw-news-block-title">
                            {
                                data.title
                            }
                        </h3>

                        {data.excerpt && (
                            <p className="mw-news-block-excerpt">
                                {
                                    data.excerpt
                                }
                            </p>
                        )}
                    </div>
                </a>
            </article>

            <NewsBlockDialog
                editor={editor}
                open={editOpen}
                onClose={() =>
                    setEditOpen(
                        false
                    )
                }
                initialData={
                    data
                }
                onSubmit={
                    handleUpdate
                }
            />
        </NodeViewWrapper>
    )
}
