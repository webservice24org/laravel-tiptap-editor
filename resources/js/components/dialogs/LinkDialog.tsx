import {
    useEffect,
    useState,
} from 'react'

import type {
    Editor,
} from '@tiptap/react'

import Dialog from './Dialog'

interface LinkDialogProps {
    editor: Editor

    open: boolean

    onClose: () => void
}

function normalizeUrl(
    value: string
): string {
    const url = value.trim()

    if (!url) {
        return ''
    }

    if (
        url.startsWith('/') ||
        url.startsWith('#') ||
        url.startsWith('mailto:') ||
        url.startsWith('tel:')
    ) {
        return url
    }

    if (
        /^https?:\/\//i.test(url)
    ) {
        return url
    }

    return `https://${url}`
}

function isSafeUrl(
    value: string
): boolean {
    const url = value
        .trim()
        .toLowerCase()

    if (!url) {
        return false
    }

    const blockedProtocols = [
        'javascript:',
        'data:',
        'vbscript:',
    ]

    return !blockedProtocols.some(
        (protocol) =>
            url.startsWith(protocol)
    )
}

export default function LinkDialog({
    editor,
    open,
    onClose,
}: LinkDialogProps) {
    const [
        originalText,
        setOriginalText,
    ] = useState('')

    const [text, setText] =
        useState('')

    const [url, setUrl] =
        useState('')

    const [
        openInNewTab,
        setOpenInNewTab,
    ] = useState(true)

    const [error, setError] =
        useState('')

    const linkActive =
        editor.isActive('link')

    useEffect(() => {
        if (!open) {
            return
        }

        const {
            from,
            to,
        } = editor.state.selection

        const selectedText =
            editor.state.doc.textBetween(
                from,
                to,
                ' '
            )

        const linkAttributes =
            editor.getAttributes('link')

        setText(selectedText)
        setOriginalText(selectedText)

        setUrl(
            linkAttributes.href ?? ''
        )

        setOpenInNewTab(
            linkAttributes.target ===
                '_blank' ||
                !linkAttributes.href
        )

        setError('')
    }, [open, editor])

    const handleInsert = () => {
        if (!isSafeUrl(url)) {
            setError(
                'Please enter a valid link.'
            )

            return
        }

        const normalizedUrl =
            normalizeUrl(url)

        const target =
            openInNewTab
                ? '_blank'
                : null

        const rel =
            openInNewTab
                ? 'noopener noreferrer'
                : null

        const {
            empty,
        } = editor.state.selection

        /*
         * Existing link.
         */

        if (editor.isActive('link')) {
            editor
                .chain()
                .focus()
                .extendMarkRange('link')
                .setLink({
                    href: normalizedUrl,
                    target,
                    rel,
                })
                .run()

            onClose()

            return
        }

        /*
         * Selected text.
         */

        if (!empty) {
            if (
                text.trim() &&
                text !== originalText
            ) {
                editor
                    .chain()
                    .focus()
                    .insertContent({
                        type: 'text',

                        text: text.trim(),

                        marks: [
                            {
                                type: 'link',

                                attrs: {
                                    href:
                                        normalizedUrl,

                                    target,

                                    rel,
                                },
                            },
                        ],
                    })
                    .run()
            } else {
                editor
                    .chain()
                    .focus()
                    .setLink({
                        href: normalizedUrl,
                        target,
                        rel,
                    })
                    .run()
            }

            onClose()

            return
        }

        /*
         * No selection.
         *
         * Insert link text directly.
         */

        const linkText =
            text.trim() ||
            normalizedUrl

        editor
            .chain()
            .focus()
            .insertContent({
                type: 'text',

                text: linkText,

                marks: [
                    {
                        type: 'link',

                        attrs: {
                            href: normalizedUrl,
                            target,
                            rel,
                        },
                    },
                ],
            })
            .run()

        onClose()
    }

    const handleRemove = () => {
        editor
            .chain()
            .focus()
            .extendMarkRange('link')
            .unsetLink()
            .run()

        onClose()
    }

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title={
                linkActive
                    ? 'Edit Link'
                    : 'Insert Link'
            }
            description="Add a link to selected text or insert a new linked text."
        >
            <div className="mw-dialog-body">
                <div className="mw-form-group">
                    <label
                        className="mw-form-label"
                        htmlFor="mw-link-text"
                    >
                        Text
                    </label>

                    <input
                        id="mw-link-text"
                        type="text"
                        className="mw-form-input"
                        value={text}
                        onChange={(event) =>
                            setText(
                                event.target.value
                            )
                        }
                        placeholder="Link text"
                    />
                </div>

                <div className="mw-form-group">
                    <label
                        className="mw-form-label"
                        htmlFor="mw-link-url"
                    >
                        URL
                    </label>

                    <input
                        id="mw-link-url"
                        type="text"
                        className="mw-form-input"
                        value={url}
                        onChange={(event) => {
                            setUrl(
                                event.target.value
                            )

                            setError('')
                        }}
                        placeholder="https://example.com"
                        autoFocus
                    />

                    {error && (
                        <p className="mw-form-error">
                            {error}
                        </p>
                    )}
                </div>

                <label className="mw-checkbox-row">
                    <input
                        type="checkbox"
                        checked={
                            openInNewTab
                        }
                        onChange={(event) =>
                            setOpenInNewTab(
                                event.target
                                    .checked
                            )
                        }
                    />

                    <span>
                        Open in new tab
                    </span>
                </label>
            </div>

            <div className="mw-dialog-footer">
                <div>
                    {linkActive && (
                        <button
                            type="button"
                            className="mw-dialog-button mw-dialog-button-danger"
                            onClick={
                                handleRemove
                            }
                        >
                            Remove Link
                        </button>
                    )}
                </div>

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
                            handleInsert
                        }
                    >
                        {linkActive
                            ? 'Update'
                            : 'Insert'}
                    </button>
                </div>
            </div>
        </Dialog>
    )
}