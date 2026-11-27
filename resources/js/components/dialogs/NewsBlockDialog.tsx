import {
    useEffect,
    useRef,
    useState,
} from 'react'

import type {
    Editor,
} from '@tiptap/react'

import Dialog
    from './Dialog'

import { normalizeLinkUrl, normalizeImageSource } from '../../utils/sanitizeHtml'

import type {
    NewsBlockData,
    NewsBlockStyle,
    NewsSearchHandler,
    NewsSearchResult,
} from '../../types/newsBlock'

interface NewsBlockDialogProps {
    editor: Editor
    open: boolean
    onClose: () => void
    initialData?: NewsBlockData | null
    onSubmit?: (
        data: NewsBlockData
    ) => void
    onNewsSearch?: NewsSearchHandler
}

export default function NewsBlockDialog({
    editor,
    open,
    onClose,
    initialData,
    onSubmit,
    onNewsSearch,
}: NewsBlockDialogProps) {
    const [
        title,
        setTitle,
    ] =
        useState('')

    const [
        url,
        setUrl,
    ] =
        useState('')

    const [
        thumbnail,
        setThumbnail,
    ] =
        useState('')

    const [
        category,
        setCategory,
    ] =
        useState('')

    const [
        excerpt,
        setExcerpt,
    ] =
        useState('')

    const [
        style,
        setStyle,
    ] =
        useState<NewsBlockStyle>(
            'card'
        )

    const [
        error,
        setError,
    ] =
        useState('')

    const [
        searchQuery,
        setSearchQuery,
    ] =
        useState('')

    const [
        searchResults,
        setSearchResults,
    ] =
        useState<NewsSearchResult[]>(
            []
        )

    const [
        searching,
        setSearching,
    ] =
        useState(false)

    const [
        searchError,
        setSearchError,
    ] =
        useState('')

    const searchRequestRef =
        useRef(0)

    useEffect(() => {
        if (!open) {
            return
        }

        setTitle(
            initialData?.title ??
            ''
        )

        setUrl(
            initialData?.url ??
            ''
        )

        setThumbnail(
            initialData?.thumbnail ??
            ''
        )

        setCategory(
            initialData?.category ??
            ''
        )

        setExcerpt(
            initialData?.excerpt ??
            ''
        )

        setStyle(
            initialData?.style ??
            'card'
        )

        setError('')
        setSearchQuery('')
        setSearchResults([])
        setSearchError('')
        setSearching(false)
    }, [
        initialData,
        open,
    ])

    useEffect(() => {
        if (
            !open ||
            !onNewsSearch
        ) {
            return
        }

        const query =
            searchQuery.trim()

        if (
            query.length <
            2
        ) {
            setSearchResults([])
            setSearchError('')
            setSearching(false)

            return
        }

        const requestId =
            ++searchRequestRef.current

        const timer =
            window.setTimeout(
                async () => {
                    try {
                        setSearching(
                            true
                        )
                        setSearchError(
                            ''
                        )

                        const results =
                            await onNewsSearch(
                                query
                            )

                        if (
                            requestId !==
                            searchRequestRef.current
                        ) {
                            return
                        }

                        setSearchResults(
                            Array.isArray(
                                results
                            )
                                ? results
                                : []
                        )
                    } catch (
                        searchFailure
                    ) {
                        if (
                            requestId !==
                            searchRequestRef.current
                        ) {
                            return
                        }

                        setSearchResults(
                            []
                        )

                        setSearchError(
                            searchFailure instanceof
                                Error
                                ? searchFailure.message
                                : 'News search failed.'
                        )
                    } finally {
                        if (
                            requestId ===
                            searchRequestRef.current
                        ) {
                            setSearching(
                                false
                            )
                        }
                    }
                },
                350
            )

        return () => {
            window.clearTimeout(
                timer
            )
        }
    }, [
        onNewsSearch,
        open,
        searchQuery,
    ])

    const selectSearchResult = (
        result:
            NewsSearchResult
    ) => {
        setTitle(
            result.title ??
            ''
        )

        setUrl(
            result.url ??
            ''
        )

        setThumbnail(
            result.thumbnail ??
            ''
        )

        setCategory(
            result.category ??
            ''
        )

        setExcerpt(
            result.excerpt ??
            ''
        )

        setStyle(
            result.style ??
            style
        )

        setError('')
    }

    const handleSubmit = () => {
        const safeTitle =
            title.trim()

        const safeUrl =
            normalizeLinkUrl(url.trim(), true)

        const safeThumbnail =
            thumbnail.trim()
                ? normalizeImageSource(normalizeLinkUrl(thumbnail.trim(), true))
                : ''

        if (!safeTitle) {
            setError(
                'News title is required.'
            )

            return
        }

        if (!safeUrl) {
            setError(
                'Please enter a valid news URL.'
            )

            return
        }

        if (
            thumbnail.trim() &&
            !safeThumbnail
        ) {
            setError(
                'Please enter a valid thumbnail URL.'
            )

            return
        }

        const selectedResult =
            searchResults.find(
                (
                    result
                ) =>
                    result.title ===
                        title &&
                    result.url ===
                        url
            )

        const data:
            NewsBlockData = {
                id:
                    selectedResult?.id ??
                    initialData?.id,

                title:
                    safeTitle,

                url:
                    safeUrl,

                thumbnail:
                    safeThumbnail,

                category:
                    category.trim(),

                excerpt:
                    excerpt.trim(),

                style,
            }

        if (onSubmit) {
            onSubmit(
                data
            )
        } else {
            editor
                .chain()
                .focus()
                .insertNewsBlock({
                    newsId:
                        data.id,

                    title:
                        data.title,

                    url:
                        data.url,

                    thumbnail:
                        data.thumbnail,

                    category:
                        data.category,

                    excerpt:
                        data.excerpt,

                    style:
                        data.style,
                })
                .run()
        }

        onClose()
    }

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title={
                initialData
                    ? 'Edit News Block'
                    : 'Insert News Block'
            }
            description={
                onNewsSearch
                    ? 'Search existing news or enter the news information manually.'
                    : 'Enter the news information manually.'
            }
        >
            <div className="mw-dialog-body">
                {onNewsSearch && (
                    <div className="mw-news-search-section">
                        <label
                            className="mw-form-label"
                            htmlFor="mw-news-search"
                        >
                            Search News
                        </label>

                        <input
                            id="mw-news-search"
                            type="search"
                            className="mw-form-input"
                            value={
                                searchQuery
                            }
                            onChange={(
                                event
                            ) =>
                                setSearchQuery(
                                    event
                                        .target
                                        .value
                                )
                            }
                            placeholder="Type at least 2 characters..."
                            autoComplete="off"
                        />

                        {searching && (
                            <p className="mw-news-search-status">
                                Searching…
                            </p>
                        )}

                        {searchError && (
                            <p className="mw-form-error">
                                {
                                    searchError
                                }
                            </p>
                        )}

                        {!searching &&
                            searchQuery.trim()
                                .length >=
                                2 &&
                            !searchError &&
                            searchResults
                                .length ===
                                0 && (
                                <p className="mw-news-search-status">
                                    No news found.
                                    You can still
                                    enter the block
                                    manually.
                                </p>
                            )}

                        {searchResults
                            .length >
                            0 && (
                            <div className="mw-news-search-results">
                                {searchResults.map(
                                    (
                                        result,
                                        index
                                    ) => (
                                        <button
                                            key={
                                                result.id ??
                                                `${result.url}-${index}`
                                            }
                                            type="button"
                                            className="mw-news-search-result"
                                            onClick={() =>
                                                selectSearchResult(
                                                    result
                                                )
                                            }
                                        >
                                            {typeof result.thumbnail === 'string' && normalizeImageSource(result.thumbnail) && (
                                                <span className="mw-news-search-thumb">
                                                    <img
                                                        src={
                                                            normalizeImageSource(result.thumbnail)
                                                        }
                                                        alt=""
                                                        loading="lazy"
                                                        decoding="async"
                                                    />
                                                </span>
                                            )}

                                            <span className="mw-news-search-result-content">
                                                {result.category && (
                                                    <span className="mw-news-search-category">
                                                        {
                                                            result.category
                                                        }
                                                    </span>
                                                )}

                                                <strong>
                                                    {
                                                        result.title
                                                    }
                                                </strong>

                                                {result.excerpt && (
                                                    <span className="mw-news-search-excerpt">
                                                        {
                                                            result.excerpt
                                                        }
                                                    </span>
                                                )}
                                            </span>
                                        </button>
                                    )
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div className="mw-form-group">
                    <label
                        className="mw-form-label"
                        htmlFor="mw-news-title"
                    >
                        News Title
                    </label>

                    <input
                        id="mw-news-title"
                        type="text"
                        className="mw-form-input"
                        value={
                            title
                        }
                        onChange={(
                            event
                        ) =>
                            setTitle(
                                event
                                    .target
                                    .value
                            )
                        }
                        placeholder="Enter news title"
                    />
                </div>

                <div className="mw-form-group">
                    <label
                        className="mw-form-label"
                        htmlFor="mw-news-url"
                    >
                        News URL
                    </label>

                    <input
                        id="mw-news-url"
                        type="text"
                        className="mw-form-input"
                        value={
                            url
                        }
                        onChange={(
                            event
                        ) =>
                            setUrl(
                                event
                                    .target
                                    .value
                            )
                        }
                        placeholder="/news/example-slug"
                    />
                </div>

                <div className="mw-form-group">
                    <label
                        className="mw-form-label"
                        htmlFor="mw-news-thumbnail"
                    >
                        Thumbnail URL
                    </label>

                    <input
                        id="mw-news-thumbnail"
                        type="text"
                        className="mw-form-input"
                        value={
                            thumbnail
                        }
                        onChange={(
                            event
                        ) =>
                            setThumbnail(
                                event
                                    .target
                                    .value
                            )
                        }
                        placeholder="/storage/news/example.jpg"
                    />
                </div>

                <div className="mw-news-block-dialog-grid">
                    <div className="mw-form-group">
                        <label
                            className="mw-form-label"
                            htmlFor="mw-news-category"
                        >
                            Category
                        </label>

                        <input
                            id="mw-news-category"
                            type="text"
                            className="mw-form-input"
                            value={
                                category
                            }
                            onChange={(
                                event
                            ) =>
                                setCategory(
                                    event
                                        .target
                                        .value
                                )
                            }
                            placeholder="বাংলাদেশ"
                        />
                    </div>

                    <div className="mw-form-group">
                        <label
                            className="mw-form-label"
                            htmlFor="mw-news-style"
                        >
                            Display Style
                        </label>

                        <select
                            id="mw-news-style"
                            className="mw-form-input"
                            value={
                                style
                            }
                            onChange={(
                                event
                            ) =>
                                setStyle(
                                    event
                                        .target
                                        .value as NewsBlockStyle
                                )
                            }
                        >
                            <option value="card">
                                Card
                            </option>

                            <option value="compact">
                                Compact
                            </option>

                            <option value="featured">
                                Featured
                            </option>
                        </select>
                    </div>
                </div>

                <div className="mw-form-group">
                    <label
                        className="mw-form-label"
                        htmlFor="mw-news-excerpt"
                    >
                        Excerpt
                    </label>

                    <textarea
                        id="mw-news-excerpt"
                        className="mw-form-input mw-news-block-textarea"
                        value={
                            excerpt
                        }
                        onChange={(
                            event
                        ) =>
                            setExcerpt(
                                event
                                    .target
                                    .value
                            )
                        }
                        rows={4}
                        placeholder="Short summary or excerpt"
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
                        onClick={
                            onClose
                        }
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        className="mw-dialog-button mw-dialog-button-primary"
                        onClick={
                            handleSubmit
                        }
                    >
                        {
                            initialData
                                ? 'Update'
                                : 'Insert'
                        }
                    </button>
                </div>
            </div>
        </Dialog>
    )
}
