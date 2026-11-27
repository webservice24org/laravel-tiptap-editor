import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react'

import {
    EditorContent,
    useEditor,
} from '@tiptap/react'

import EditorToolbar
    from './toolbar/EditorToolbar'

import CodeEditor
    from './CodeEditor'

import {
    createEditorExtensions,
} from '../extensions/editorExtensions'

import {
    sanitizeEditorHtml,
} from '../utils/sanitizeHtml'

import type {
    EditorMode,
    TiptapEditorProps,
} from '../types/editor'

import '../../css/editor.css'

// Chromium can route native history events to the last edited DOM even when
// another input owns focus. Stop only those events delivered to this editor.
function guardUnfocusedHistory(
    view: { hasFocus(): boolean },
    event: Event,
): boolean {
    const inputType = (event as InputEvent).inputType
    if (inputType !== 'historyUndo' && inputType !== 'historyRedo') return false
    if (view.hasFocus()) return false
    event.preventDefault()
    // Returning true also prevents ProseMirror's history plugin from handling it.
    return true
}

export default function TiptapEditor({
    value = '',
    onChange,
    minHeight = 300,
    imageUploadUrl,
    onImageUpload,
    onNewsSearch,
}: TiptapEditorProps) {
    const [
        mode,
        setMode,
    ] =
        useState<EditorMode>(
            'visual'
        )

    const [
        sourceHtml,
        setSourceHtml,
    ] =
        useState(
            sanitizeEditorHtml(
                value
            )
        )

    // A changed controlled value is authoritative, even while source is open.
    const observedValue = useRef(value)

    const extensions =
        useMemo(
            () =>
                createEditorExtensions({
                    imageUploadUrl,
                    onImageUpload,
                }),
            [
                imageUploadUrl,
                onImageUpload,
            ]
        )

    const editor =
        useEditor({
            extensions,

            content:
                sanitizeEditorHtml(
                    value
                ),

            editorProps: {
                handleDOMEvents: {
                    beforeinput: guardUnfocusedHistory,
                },
                attributes: {
                    class:
                        'mw-tiptap-content',

                    style:
                        `min-height: ${minHeight}px`,
                },
            },

            onUpdate: ({
                editor:
                    currentEditor,
            }) => {
                if (
                    mode !==
                    'visual'
                ) {
                    return
                }

                const html =
                    sanitizeEditorHtml(
                        currentEditor
                            .getHTML()
                    )

                setSourceHtml(
                    html
                )

                onChange?.(
                    html
                )
            },
        })

    useEffect(() => {
        const valueChanged = observedValue.current !== value
        observedValue.current = value

        if (mode === 'code') {
            if (valueChanged) {
                setSourceHtml(sanitizeEditorHtml(value))
            }
            return
        }

        if (!editor) {
            return
        }

        const cleanValue =
            sanitizeEditorHtml(
                value
            )

        const currentHtml =
            sanitizeEditorHtml(
                editor.getHTML()
            )

        if (
            cleanValue !==
            currentHtml
        ) {
            editor.commands.setContent(
                cleanValue,
                {
                    emitUpdate:
                        false,
                }
            )

            setSourceHtml(
                cleanValue
            )
        }
    }, [
        editor,
        mode,
        value,
    ])

    if (!editor) {
        return null
    }

    const switchMode = (
        nextMode: EditorMode
    ) => {
        if (
            nextMode ===
            mode
        ) {
            return
        }

        if (
            nextMode ===
            'code'
        ) {
            const cleanHtml =
                sanitizeEditorHtml(
                    editor.getHTML()
                )

            setSourceHtml(
                cleanHtml
            )

            setMode(
                'code'
            )

            return
        }

        const cleanHtml =
            sanitizeEditorHtml(
                sourceHtml
            )

        editor.commands.setContent(
            cleanHtml,
            {
                emitUpdate:
                    false,
            }
        )

        const normalizedHtml =
            sanitizeEditorHtml(
                editor.getHTML()
            )

        setSourceHtml(
            normalizedHtml
        )

        onChange?.(
            normalizedHtml
        )

        setMode(
            'visual'
        )
    }

    const handleSourceChange = (
        html: string
    ) => {
        setSourceHtml(
            html
        )
    }

    return (
        <div
            className="mw-tiptap-editor"
            data-editor-mode={
                mode
            }
        >
            <EditorToolbar
                editor={
                    editor
                }
                imageUploadUrl={
                    imageUploadUrl
                }
                onImageUpload={
                    onImageUpload
                }
                onNewsSearch={
                    onNewsSearch
                }
                mode={
                    mode
                }
                onModeChange={
                    switchMode
                }
            />

            {mode ===
            'visual' ? (
                <EditorContent
                    editor={
                        editor
                    }
                />
            ) : (
                <CodeEditor
                    value={
                        sourceHtml
                    }
                    onChange={
                        handleSourceChange
                    }
                    minHeight={
                        minHeight
                    }
                />
            )}
        </div>
    )
}
