import {
    useMemo,
    useRef,
    useState,
} from 'react'

import type {
    ChangeEvent,
    KeyboardEvent,
    UIEvent,
} from 'react'

interface CodeEditorProps {
    value: string
    onChange: (
        value: string
    ) => void
    minHeight?: number
}

const VOID_TAGS = new Set([
    'area', 'base', 'br', 'col', 'embed',
    'hr', 'img', 'input', 'link', 'meta',
    'param', 'source', 'track', 'wbr',
])

const RAW_TAGS = new Set([
    'pre', 'script', 'style', 'textarea',
])

const getTagName = (
    token: string
) => {
    const match =
        token.match(
            /^<\/?\s*([a-zA-Z0-9-]+)/
        )

    return match?.[1]
        ?.toLowerCase() ?? ''
}

const isClosingTag = (
    token: string
) => /^<\//.test(token)

const isOpeningTag = (
    token: string
) =>
    /^<[a-zA-Z]/.test(token) &&
    !isClosingTag(token)

const isSelfClosing = (
    token: string
) => /\/>\s*$/.test(token)

const tokenizeHtml = (
    html: string
) => {
    const tokens: string[] = []
    let index = 0

    while (index < html.length) {
        if (
            html.startsWith(
                '<!--',
                index
            )
        ) {
            const end =
                html.indexOf(
                    '-->',
                    index + 4
                )

            const finalIndex =
                end === -1
                    ? html.length
                    : end + 3

            tokens.push(
                html.slice(
                    index,
                    finalIndex
                )
            )

            index =
                finalIndex

            continue
        }

        if (html[index] === '<') {
            const tagEnd =
                html.indexOf(
                    '>',
                    index + 1
                )

            if (tagEnd === -1) {
                tokens.push(
                    html.slice(index)
                )
                break
            }

            const tag =
                html.slice(
                    index,
                    tagEnd + 1
                )

            tokens.push(tag)

            const tagName =
                getTagName(tag)

            if (
                isOpeningTag(tag) &&
                RAW_TAGS.has(tagName) &&
                !isSelfClosing(tag)
            ) {
                const closeStart =
                    html
                        .toLowerCase()
                        .indexOf(
                            `</${tagName}`,
                            tagEnd + 1
                        )

                if (closeStart !== -1) {
                    const rawContent =
                        html.slice(
                            tagEnd + 1,
                            closeStart
                        )

                    if (rawContent) {
                        tokens.push(
                            rawContent
                        )
                    }

                    const closeEnd =
                        html.indexOf(
                            '>',
                            closeStart
                        )

                    if (closeEnd !== -1) {
                        tokens.push(
                            html.slice(
                                closeStart,
                                closeEnd + 1
                            )
                        )

                        index =
                            closeEnd + 1

                        continue
                    }
                }
            }

            index =
                tagEnd + 1

            continue
        }

        const nextTag =
            html.indexOf(
                '<',
                index
            )

        const end =
            nextTag === -1
                ? html.length
                : nextTag

        tokens.push(
            html.slice(
                index,
                end
            )
        )

        index = end
    }

    return tokens
}

export const formatHtml = (
    html: string
) => {
    const source =
        html.trim()

    if (!source) {
        return ''
    }

    const tokens =
        tokenizeHtml(source)

    const lines: string[] = []
    let indent = 0
    let rawTag: string | null = null

    const addLine = (
        content: string,
        level = indent
    ) => {
        const text =
            content.trim()

        if (!text) {
            return
        }

        lines.push(
            `${'    '.repeat(
                Math.max(0, level)
            )}${text}`
        )
    }

    for (const token of tokens) {
        const trimmed =
            token.trim()

        if (!trimmed) {
            continue
        }

        if (rawTag) {
            if (
                trimmed
                    .toLowerCase()
                    .startsWith(
                        `</${rawTag}`
                    )
            ) {
                indent =
                    Math.max(
                        0,
                        indent - 1
                    )

                addLine(trimmed)
                rawTag = null
            } else {
                token
                    .replace(
                        /^\n+|\n+$/g,
                        ''
                    )
                    .split('\n')
                    .forEach(
                        line => {
                            if (
                                line.trim()
                            ) {
                                addLine(
                                    line,
                                    indent
                                )
                            }
                        }
                    )
            }

            continue
        }

        if (
            trimmed.startsWith(
                '<!--'
            ) ||
            /^<!DOCTYPE/i.test(
                trimmed
            ) ||
            /^<\?/.test(
                trimmed
            )
        ) {
            addLine(trimmed)
            continue
        }

        if (
            isClosingTag(
                trimmed
            )
        ) {
            indent =
                Math.max(
                    0,
                    indent - 1
                )

            addLine(trimmed)
            continue
        }

        if (
            isOpeningTag(
                trimmed
            )
        ) {
            const tagName =
                getTagName(
                    trimmed
                )

            addLine(trimmed)

            if (
                RAW_TAGS.has(
                    tagName
                ) &&
                !isSelfClosing(
                    trimmed
                )
            ) {
                rawTag = tagName
                indent += 1
                continue
            }

            if (
                !VOID_TAGS.has(
                    tagName
                ) &&
                !isSelfClosing(
                    trimmed
                )
            ) {
                indent += 1
            }

            continue
        }

        addLine(
            trimmed.replace(
                /\s+/g,
                ' '
            )
        )
    }

    return lines.join('\n')
}

const escapeHtml = (
    value: string
) =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')

const highlightTag = (
    tag: string
) => {
    const escaped =
        escapeHtml(tag)

    return escaped.replace(
        /(&lt;\/?)([A-Za-z][\w:-]*)([\s\S]*?)(\/?&gt;)/g,
        (
            _match,
            opening,
            name,
            middle,
            closing
        ) => {
            const attributes =
                String(middle).replace(
                    /([\w:-]+)(\s*=\s*)(&quot;.*?&quot;|&#39;.*?&#39;|"[^"]*"|'[^']*')/g,
                    (
                        _attribute,
                        attrName,
                        equals,
                        attrValue
                    ) =>
                        `<span class="mw-code-attribute">${attrName}</span>${equals}<span class="mw-code-string">${attrValue}</span>`
                )

            return (
                `<span class="mw-code-punctuation">${opening}</span>` +
                `<span class="mw-code-tag">${name}</span>` +
                attributes +
                `<span class="mw-code-punctuation">${closing}</span>`
            )
        }
    )
}

const highlightHtml = (
    value: string
) => {
    const pattern =
        /<!--[\s\S]*?-->|<!DOCTYPE[\s\S]*?>|<\/?[A-Za-z][^>]*>/gi

    let output = ''
    let lastIndex = 0

    for (
        const match
        of value.matchAll(pattern)
    ) {
        const index =
            match.index ?? 0

        output +=
            `<span class="mw-code-text">${escapeHtml(
                value.slice(
                    lastIndex,
                    index
                )
            )}</span>`

        const token =
            match[0]

        if (
            token.startsWith(
                '<!--'
            )
        ) {
            output +=
                `<span class="mw-code-comment">${escapeHtml(
                    token
                )}</span>`
        } else if (
            /^<!DOCTYPE/i.test(
                token
            )
        ) {
            output +=
                `<span class="mw-code-doctype">${escapeHtml(
                    token
                )}</span>`
        } else {
            output +=
                highlightTag(
                    token
                )
        }

        lastIndex =
            index +
            token.length
    }

    output +=
        `<span class="mw-code-text">${escapeHtml(
            value.slice(
                lastIndex
            )
        )}</span>`

    return output || ' '
}

export default function CodeEditor({
    value,
    onChange,
    minHeight = 300,
}: CodeEditorProps) {
    const textareaRef =
        useRef<HTMLTextAreaElement>(
            null
        )

    const highlightRef =
        useRef<HTMLPreElement>(
            null
        )

    const [status, setStatus] =
        useState<
            'saved' |
            'formatted'
        >('saved')

    const lineCount =
        useMemo(
            () =>
                Math.max(
                    1,
                    value
                        .split('\n')
                        .length
                ),
            [value]
        )

    const highlighted =
        useMemo(
            () =>
                highlightHtml(
                    value
                ),
            [value]
        )

    const syncScroll = (
        event:
            UIEvent<HTMLTextAreaElement>
    ) => {
        const highlight =
            highlightRef.current

        if (!highlight) {
            return
        }

        highlight.scrollTop =
            event.currentTarget
                .scrollTop

        highlight.scrollLeft =
            event.currentTarget
                .scrollLeft
    }

    const handleChange = (
        event:
            ChangeEvent<HTMLTextAreaElement>
    ) => {
        onChange(
            event.target.value
        )

        setStatus('saved')
    }

    const handleFormat = () => {
        const formatted =
            formatHtml(value)

        onChange(formatted)
        setStatus('formatted')
    }

    const handleKeyDown = (
        event:
            KeyboardEvent<HTMLTextAreaElement>
    ) => {
        if (
            event.key !== 'Tab'
        ) {
            return
        }

        event.preventDefault()

        const textarea =
            event.currentTarget

        const start =
            textarea.selectionStart

        const end =
            textarea.selectionEnd

        const indentation =
            '    '

        const nextValue =
            value.slice(
                0,
                start
            ) +
            indentation +
            value.slice(end)

        onChange(nextValue)

        requestAnimationFrame(
            () => {
                textarea.selectionStart =
                    textarea.selectionEnd =
                        start +
                        indentation.length
            }
        )
    }

    return (
        <div className="mw-code-editor">
            <div className="mw-code-editor-header">
                <div className="mw-code-editor-actions">
                    <button
                        type="button"
                        className="mw-code-format-button"
                        onClick={
                            handleFormat
                        }
                        title="Format HTML"
                    >
                        <span
                            aria-hidden="true"
                            className="mw-code-format-icon"
                        >
                            ✣
                        </span>

                        <span>
                            Format
                        </span>
                    </button>
                </div>

                <div className="mw-code-editor-meta">
                    <span>
                        {lineCount}{' '}
                        {lineCount === 1
                            ? 'line'
                            : 'lines'}
                    </span>

                    <span
                        className="mw-code-editor-status"
                        aria-live="polite"
                    >
                        {status ===
                        'formatted'
                            ? 'Formatted'
                            : 'Saved'}
                    </span>
                </div>
            </div>

            <div
                className="mw-code-editor-surface"
                style={{
                    minHeight:
                        `${minHeight}px`,
                }}
            >
                <pre
                    ref={
                        highlightRef
                    }
                    className="mw-code-editor-highlight"
                    aria-hidden="true"
                    dangerouslySetInnerHTML={{
                        __html:
                            highlighted,
                    }}
                />

                <textarea
                    ref={
                        textareaRef
                    }
                    className="mw-code-editor-textarea"
                    value={
                        value
                    }
                    onChange={
                        handleChange
                    }
                    onKeyDown={
                        handleKeyDown
                    }
                    onScroll={
                        syncScroll
                    }
                    spellCheck={
                        false
                    }
                    autoCapitalize="off"
                    autoCorrect="off"
                    aria-label="HTML source"
                />
            </div>
        </div>
    )
}
