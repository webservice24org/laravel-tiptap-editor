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
            },
        }),

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
