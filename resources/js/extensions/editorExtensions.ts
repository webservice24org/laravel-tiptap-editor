import { Mark } from '@tiptap/core'
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
        Subscript.extend({ excludes: 'superscript' }),

        Superscript.extend({ excludes: 'subscript' }),

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
