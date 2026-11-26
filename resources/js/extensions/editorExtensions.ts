import { Mark, CommandManager, type Editor, type ChainedCommands } from '@tiptap/core'
import { isTextPreset, normalizeLinkUrl, type TextPresetProperty } from '../utils/sanitizeHtml'

import StarterKit
    from '@tiptap/starter-kit'

import TextAlign
    from '@tiptap/extension-text-align'

import Subscript
    from '@tiptap/extension-subscript'

import Superscript
    from '@tiptap/extension-superscript'

import {
    TableRow,
} from '@tiptap/extension-table'

import ImageFigure
    from './ImageFigure'

import VideoEmbed
    from './VideoEmbed'

import NewsBlock
    from './NewsBlock'

import CustomTable
    from './Table'

import CustomTableCell
    from './TableCell'

import CustomTableHeader
    from './TableHeader'

import type {
    EditorExtensionOptions,
} from '../types/editor'

type ScriptMark = 'subscript' | 'superscript'

// Use the same ordering for the capability probe and the actual action.
// The opposing mark must be removed before the target's ordinary toggle.
function scriptChain(chain: ChainedCommands, mark: ScriptMark) {
    return mark === 'subscript'
        ? chain.unsetSuperscript().toggleSubscript()
        : chain.unsetSubscript().toggleSuperscript()
}

export function canToggleScript(editor: Editor, mark: ScriptMark): boolean {
    if (!editor.isEditable || editor.isDestroyed) return false

    // Tiptap 3.32.0 can() suppresses mutations, so a normal can().chain()
    // cannot model removal of an excluding mark. An explicit start transaction
    // lets CommandManager run mark commands without dispatching to the view.
    // No focus command, plugin dispatch, or document update is used in this probe.
    const scratch = new CommandManager({ editor }).createChain(editor.state.tr)
    return scriptChain(scratch, mark).run()
}

export function applyScript(editor: Editor, mark: ScriptMark): boolean {
    if (!canToggleScript(editor, mark)) return false
    return scriptChain(editor.chain().focus(), mark).run()
}

function presetMark(name: string, property: TextPresetProperty) {
    return Mark.create({
        name,
        addAttributes() {
            return { value: { default: null, rendered: false } }
        },
        parseHTML() {
            return [{ tag: 'span[style]', consuming: false, getAttrs: (node: HTMLElement) => {
                const value = (node as HTMLElement).style.getPropertyValue(property).trim()
                return isTextPreset(property, value) ? { value } : false
            } }]
        },
        renderHTML({ mark }) {
            const value = mark.attrs.value
            return typeof value === 'string' && isTextPreset(property, value)
                ? ['span', { style: `${property}: ${value}` }, 0]
                : ['span', {}, 0]
        },
    })
}

export function createEditorExtensions({
    imageUploadUrl =
        '/tiptap-editor/media',

    onImageUpload,
}: EditorExtensionOptions = {}) {
    return [
        StarterKit.configure({
            heading: {
                levels: [
                    1,
                    2,
                    3,
                ],
            },

            link: {
                openOnClick:
                    false,

                autolink:
                    true,

                linkOnPaste:
                    true,

                defaultProtocol:
                    'https',
                // Linkify supplies bare hosts to its validation callback.
                isAllowedUri: (url, context) => context.defaultValidate(url) && Boolean(normalizeLinkUrl(url, true)),
                shouldAutoLink: url => Boolean(normalizeLinkUrl(url, true)) &&
                    (/^https?:\/\//i.test(url) || (/^[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[/?#]|$)/i.test(url) && !/^\d{1,3}(?:\.\d{1,3}){3}(?:[/?#]|$)/.test(url))),
            },
        }),

        presetMark('mwTextColor', 'color'),
        presetMark('mwFontSize', 'font-size'),
        presetMark('mwFontFamily', 'font-family'),

        TextAlign.configure({
            types: [
                'heading',
                'paragraph',
            ],

            alignments: [
                'left',
                'center',
                'right',
                'justify',
            ],
        }),

        // Both marks are installed together; one baseline position per character.
        Subscript.extend({
            excludes: 'superscript',
            addKeyboardShortcuts() {
                return { 'Mod-,': () => applyScript(this.editor, 'subscript') }
            },
        }),

        Superscript.extend({
            excludes: 'subscript',
            addKeyboardShortcuts() {
                return { 'Mod-.': () => applyScript(this.editor, 'superscript') }
            },
        }),

        ImageFigure.configure({
            imageUploadUrl,

            onImageUpload,
        }),

        VideoEmbed,

        NewsBlock,

        CustomTable.configure({
            resizable:
                true,

            lastColumnResizable:
                true,

            allowTableNodeSelection:
                true,
        }),

        TableRow,

        CustomTableHeader,

        CustomTableCell,
    ]
}
