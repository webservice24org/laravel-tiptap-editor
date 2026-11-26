import {
    useEditorState,
} from '@tiptap/react'

import type {
    Editor,
} from '@tiptap/react'

import { useState } from 'react'
import { CommandManager, type ChainedCommands } from '@tiptap/core'

import EditorButton from './EditorButton'
import ToolbarGroup from './ToolbarGroup'
import FormatDropdown from './FormatDropdown'
import LinkDialog, { canEditLink } from '../dialogs/LinkDialog'
import { isTextPreset, type TextPresetProperty } from '../../utils/sanitizeHtml'
import ImageDialog from '../dialogs/ImageDialog'

import type { ImageUploadResult } from '../../types/media'
import type { NewsSearchHandler } from '../../types/newsBlock'
import VideoDialog from '../dialogs/VideoDialog'

import TableDialog from '../dialogs/TableDialog'
import NewsBlockDialog from '../dialogs/NewsBlockDialog'
import TableContextualToolbar from './TableContextualToolbar'

import {
    CodeModeIcon,
    NewsBlockIcon,
    TableIcon,
    VideoIcon,
    VisualModeIcon,
} from '../icons/TopToolbarIcons'

import {
    AlignCenterIcon,
    AlignLeftIcon,
    AlignRightIcon,
    BoldIcon,
    BulletListIcon,
    ClearIcon,
    HorizontalRuleIcon,
    ItalicIcon,
    IndentListIcon,
    OutdentListIcon,
    JustifyIcon,
    OrderedListIcon,
    QuoteIcon,
    RedoIcon,
    StrikeIcon,
    SubscriptIcon,
    SuperscriptIcon,
    UnderlineIcon,
    UndoIcon,
    LinkIcon,
    UnlinkIcon,
    MediaIcon,
} from '../icons/EditorIcons'

type ScriptMark = 'subscript' | 'superscript'

// Use the same ordering for the capability probe and the actual action.
// The opposing mark must be removed before the target's ordinary toggle.
function scriptChain(chain: ChainedCommands, mark: ScriptMark) {
    return mark === 'subscript'
        ? chain.unsetSuperscript().toggleSubscript()
        : chain.unsetSubscript().toggleSuperscript()
}

function canToggleScript(editor: Editor, mark: ScriptMark): boolean {
    if (!editor.isEditable || editor.isDestroyed) return false

    // Tiptap 3.32.0 can() suppresses mutations, so a normal can().chain()
    // cannot model removal of an excluding mark. An explicit start transaction
    // lets CommandManager run mark commands without dispatching to the view.
    // No focus command, plugin dispatch, or document update is used in this probe.
    const scratch = new CommandManager({ editor }).createChain(editor.state.tr)
    return scriptChain(scratch, mark).run()
}

function applyScript(editor: Editor, mark: ScriptMark): boolean {
    if (!canToggleScript(editor, mark)) return false
    return scriptChain(editor.chain().focus(), mark).run()
}

type ListAction = 'bullet' | 'ordered' | 'indent' | 'outdent'
type Alignment = 'left' | 'center' | 'right' | 'justify'

function canListAction(editor: Editor, action: ListAction): boolean {
    if (!editor.isEditable || editor.isDestroyed) return false
    const commands = editor.can()
    switch (action) {
        case 'bullet': return commands.toggleBulletList()
        case 'ordered': return commands.toggleOrderedList()
        case 'indent': return commands.sinkListItem('listItem')
        case 'outdent': return commands.liftListItem('listItem')
    }
}

function applyListAction(editor: Editor, action: ListAction): boolean {
    if (!canListAction(editor, action)) return false
    const chain = editor.chain().focus()
    switch (action) {
        case 'bullet': return chain.toggleBulletList().run()
        case 'ordered': return chain.toggleOrderedList().run()
        case 'indent': return chain.sinkListItem('listItem').run()
        case 'outdent': return chain.liftListItem('listItem').run()
    }
}

// TextAlign only supports paragraphs and headings. Do not enable alignment
// for a code block or a selection containing only unsupported node types.
// A mixed selection with an unsupported text block must not be partly aligned.
function canAlignSelection(editor: Editor, alignment: Alignment): boolean {
    if (!editor.isEditable || editor.isDestroyed || editor.isActive('table')) return false
    const { selection, doc } = editor.state
    const supported = (name: string) => name === 'paragraph' || name === 'heading'
    if (selection.empty) {
        if (!supported(selection.$from.parent.type.name)) return false
    } else {
        let found = false
        let unsupported = false
        doc.nodesBetween(selection.from, selection.to, node => {
            if (node.type.name === 'table') {
                unsupported = true
            } else if (node.isTextblock) {
                if (supported(node.type.name)) found = true
                else unsupported = true
            } else if (node.isBlock && node.isAtom) {
                unsupported = true
            }
        })
        if (!found || unsupported) return false
    }
    return editor.can().setTextAlign(alignment)
}

function applyAlignment(editor: Editor, alignment: Alignment): boolean {
    if (!canAlignSelection(editor, alignment)) return false
    return editor.chain().focus().setTextAlign(alignment).run()
}

type PresetMark = 'mwTextColor' | 'mwFontSize' | 'mwFontFamily'
function canSetPreset(editor: Editor, mark: PresetMark): boolean {
    return editor.isEditable && !editor.isDestroyed && editor.can().setMark(mark)
}
function presetValue(editor: Editor, mark: PresetMark): string {
    const value = editor.getAttributes(mark).value
    return typeof value === 'string' && editor.isActive(mark, { value }) ? value : ''
}
function applyPreset(editor: Editor, mark: PresetMark, property: TextPresetProperty, value: string): boolean {
    if (!canSetPreset(editor, mark)) return false
    if (value === 'default') return editor.chain().focus().unsetMark(mark).run()
    if (!isTextPreset(property, value)) return false
    return editor.chain().focus().setMark(mark, { value }).run()
}

interface EditorToolbarProps {
    editor: Editor

    mode?: 'visual' | 'code'

    onModeChange?: (
        mode: 'visual' | 'code'
    ) => void

    imageUploadUrl?: string

    onImageUpload?: (
        file: File
    ) => Promise<ImageUploadResult>

    onNewsSearch?: NewsSearchHandler
}

export default function EditorToolbar({
    editor,
    mode = 'visual',
    onModeChange,
    imageUploadUrl,
    onImageUpload,
    onNewsSearch,
}: EditorToolbarProps) {
    const clearFormatting = () => {
        editor
            .chain()
            .focus()
            .clearNodes()
            .unsetAllMarks()
            .run()
    }

    const [
        linkDialogOpen,
        setLinkDialogOpen,
    ] = useState(false)

    const [
        imageDialogOpen,
        setImageDialogOpen,
    ] = useState(false)

    const [
        videoDialogOpen,
        setVideoDialogOpen,
    ] = useState(false)

    const [
        tableDialogOpen,
        setTableDialogOpen,
    ] = useState(false)

    const [
        newsBlockDialogOpen,
        setNewsBlockDialogOpen,
    ] = useState(false)

    // Selection-only transactions and stored marks must update formatting controls.
    const formatting = useEditorState({
        editor,
        selector: ({ editor: currentEditor }) => ({
            isInsideTable: currentEditor.isActive('table'),
            bold: currentEditor.isActive('bold'),
            canBold: currentEditor.isEditable && currentEditor.can().toggleBold(),
            italic: currentEditor.isActive('italic'),
            canItalic: currentEditor.isEditable && currentEditor.can().toggleItalic(),
            underline: currentEditor.isActive('underline'),
            canUnderline: currentEditor.isEditable && currentEditor.can().toggleUnderline(),
            strike: currentEditor.isActive('strike'),
            canStrike: currentEditor.isEditable && currentEditor.can().toggleStrike(),
            subscript: currentEditor.isActive('subscript'),
            canSubscript: canToggleScript(currentEditor, 'subscript'),
            superscript: currentEditor.isActive('superscript'),
            canSuperscript: canToggleScript(currentEditor, 'superscript'),
            bulletList: currentEditor.isActive('bulletList'),
            orderedList: currentEditor.isActive('orderedList'),
            canBulletList: canListAction(currentEditor, 'bullet'),
            canOrderedList: canListAction(currentEditor, 'ordered'),
            canIndentList: canListAction(currentEditor, 'indent'),
            canOutdentList: canListAction(currentEditor, 'outdent'),
            alignLeft: currentEditor.isActive({ textAlign: 'left' }),
            alignCenter: currentEditor.isActive({ textAlign: 'center' }),
            alignRight: currentEditor.isActive({ textAlign: 'right' }),
            alignJustify: currentEditor.isActive({ textAlign: 'justify' }),
            canAlignLeft: canAlignSelection(currentEditor, 'left'),
            canAlignCenter: canAlignSelection(currentEditor, 'center'),
            canAlignRight: canAlignSelection(currentEditor, 'right'),
            canAlignJustify: canAlignSelection(currentEditor, 'justify'),
            link: currentEditor.isActive('link'),
            canLink: canEditLink(currentEditor),
            canUnlink: currentEditor.isEditable && currentEditor.isActive('link') && currentEditor.can().unsetLink(),
            textColor: presetValue(currentEditor, 'mwTextColor'),
            fontSize: presetValue(currentEditor, 'mwFontSize'),
            fontFamily: presetValue(currentEditor, 'mwFontFamily'),
            canTextColor: canSetPreset(currentEditor, 'mwTextColor'),
            canFontSize: canSetPreset(currentEditor, 'mwFontSize'),
            canFontFamily: canSetPreset(currentEditor, 'mwFontFamily'),
            blockquote: currentEditor.isActive('blockquote'),
            canBlockquote: currentEditor.isEditable && currentEditor.can().toggleBlockquote(),
            canHorizontalRule: currentEditor.isEditable && currentEditor.can().setHorizontalRule(),
            canClear: currentEditor.isEditable && currentEditor.can().chain().clearNodes().unsetAllMarks().run(),
        }),
    })
    const isInsideTable = formatting.isInsideTable

    return (
        <>
            <div
                className="mw-tiptap-toolbar-main"
                role="toolbar"
                aria-label="Editor insert and view controls"
            >
                <FormatDropdown editor={editor} disabled={mode !== 'visual'} />

                <button
                    type="button"
                    className="mw-tiptap-action-button"
                    onClick={() => setImageDialogOpen(true)}
                    aria-label="Add image"
                    title="Add image"
                >
                    <MediaIcon />
                    <span>Add Media</span>
                </button>

                <button
                    type="button"
                    className="mw-tiptap-action-button"
                    onClick={() => setVideoDialogOpen(true)}
                    aria-label="Add video"
                    title="Add video"
                >
                    <VideoIcon />
                    <span>Add Video</span>
                </button>

                <button
                    type="button"
                    className="mw-tiptap-action-button"
                    onClick={() => setTableDialogOpen(true)}
                    aria-label="Insert table"
                    title="Insert table"
                >
                    <TableIcon />
                    <span>Insert Table</span>
                </button>

                <button
                    type="button"
                    className="mw-tiptap-action-button"
                    onClick={() =>
                        setNewsBlockDialogOpen(
                            true
                        )
                    }
                    aria-label="Insert news block"
                    title="Insert news block"
                >
                    <NewsBlockIcon />
                    <span>News Block</span>
                </button>

                <div
                    className="mw-editor-mode-switch"
                    role="group"
                    aria-label="Editor view mode"
                >
                    <button
                        type="button"
                        className={
                            mode ===
                            'visual'
                                ? 'is-active'
                                : undefined
                        }
                        onClick={() =>
                            onModeChange?.(
                                'visual'
                            )
                        }
                        aria-pressed={
                            mode ===
                            'visual'
                        }
                        aria-label="Visual editor"
                        title="Visual editor"
                    >
                        <VisualModeIcon />
                        <span>Visual</span>
                    </button>

                    <button
                        type="button"
                        className={
                            mode ===
                            'code'
                                ? 'is-active'
                                : undefined
                        }
                        onClick={() =>
                            onModeChange?.(
                                'code'
                            )
                        }
                        aria-pressed={
                            mode ===
                            'code'
                        }
                        aria-label="HTML code editor"
                        title="HTML code editor"
                    >
                        <CodeModeIcon />
                        <span>Code</span>
                    </button>
                </div>
            </div>


            {mode === 'visual' && (
                <>
                    <div
                        className="mw-tiptap-toolbar"
                        role="toolbar"
                        aria-label="Text formatting controls"
                    >
                <ToolbarGroup>
                    <EditorButton
                        active={formatting.bold}
                        disabled={!formatting.canBold}
                        onMouseDown={event => event.preventDefault()}
                        tooltip="Bold"
                        onClick={() =>
                            editor
                                .chain()
                                .focus()
                                .toggleBold()
                                .run()
                        }
                    >
                        <BoldIcon />
                    </EditorButton>

                    <EditorButton
                        active={formatting.italic}
                        disabled={!formatting.canItalic}
                        onMouseDown={event => event.preventDefault()}
                        tooltip="Italic"
                        onClick={() =>
                            editor
                                .chain()
                                .focus()
                                .toggleItalic()
                                .run()
                        }
                    >
                        <ItalicIcon />
                    </EditorButton>

                    <EditorButton
                        active={formatting.underline}
                        disabled={!formatting.canUnderline}
                        onMouseDown={event => event.preventDefault()}
                        tooltip="Underline"
                        onClick={() =>
                            editor
                                .chain()
                                .focus()
                                .toggleUnderline()
                                .run()
                        }
                    >
                        <UnderlineIcon />
                    </EditorButton>

                    <EditorButton
                        active={formatting.strike}
                        disabled={!formatting.canStrike}
                        onMouseDown={event => event.preventDefault()}
                        tooltip="Strike"
                        onClick={() =>
                            editor
                                .chain()
                                .focus()
                                .toggleStrike()
                                .run()
                        }
                    >
                        <StrikeIcon />
                    </EditorButton>

                    <EditorButton
                        active={formatting.subscript}
                        disabled={!formatting.canSubscript}
                        onMouseDown={event => event.preventDefault()}
                        tooltip="Subscript"
                        onClick={() => applyScript(editor, 'subscript')}
                    >
                        <SubscriptIcon />
                    </EditorButton>

                    <EditorButton
                        active={formatting.superscript}
                        disabled={!formatting.canSuperscript}
                        onMouseDown={event => event.preventDefault()}
                        tooltip="Superscript"
                        onClick={() => applyScript(editor, 'superscript')}
                    >
                        <SuperscriptIcon />
                    </EditorButton>
                </ToolbarGroup>

                <div className="mw-tiptap-toolbar-separator" />

                <ToolbarGroup>
                    <EditorButton
                        active={formatting.bulletList}
                        disabled={!formatting.canBulletList}
                        onMouseDown={event => event.preventDefault()}
                        tooltip="Bullet List"
                        onClick={() => applyListAction(editor, 'bullet')}
                    >
                        <BulletListIcon />
                    </EditorButton>

                    <EditorButton
                        active={formatting.orderedList}
                        disabled={!formatting.canOrderedList}
                        onMouseDown={event => event.preventDefault()}
                        tooltip="Ordered List"
                        onClick={() => applyListAction(editor, 'ordered')}
                    >
                        <OrderedListIcon />
                    </EditorButton>

                    <EditorButton
                        disabled={!formatting.canIndentList}
                        onMouseDown={event => event.preventDefault()}
                        tooltip="Indent List Item"
                        onClick={() => applyListAction(editor, 'indent')}
                    >
                        <IndentListIcon />
                    </EditorButton>

                    <EditorButton
                        disabled={!formatting.canOutdentList}
                        onMouseDown={event => event.preventDefault()}
                        tooltip="Outdent List Item"
                        onClick={() => applyListAction(editor, 'outdent')}
                    >
                        <OutdentListIcon />
                    </EditorButton>
                </ToolbarGroup>

                {!isInsideTable && (
                    <>
                    <div className="mw-tiptap-toolbar-separator" />

                    <ToolbarGroup>
                        <EditorButton
                            active={formatting.alignLeft}
                            disabled={!formatting.canAlignLeft}
                            onMouseDown={event => event.preventDefault()}
                            tooltip="Align Left"
                            onClick={() => applyAlignment(editor, 'left')}
                        >
                            <AlignLeftIcon />
                        </EditorButton>

                        <EditorButton
                            active={formatting.alignCenter}
                            disabled={!formatting.canAlignCenter}
                            onMouseDown={event => event.preventDefault()}
                            tooltip="Align Center"
                            onClick={() => applyAlignment(editor, 'center')}
                        >
                            <AlignCenterIcon />
                        </EditorButton>

                        <EditorButton
                            active={formatting.alignRight}
                            disabled={!formatting.canAlignRight}
                            onMouseDown={event => event.preventDefault()}
                            tooltip="Align Right"
                            onClick={() => applyAlignment(editor, 'right')}
                        >
                            <AlignRightIcon />
                        </EditorButton>

                        <EditorButton
                            active={formatting.alignJustify}
                            disabled={!formatting.canAlignJustify}
                            onMouseDown={event => event.preventDefault()}
                            tooltip="Justify"
                            onClick={() => applyAlignment(editor, 'justify')}
                        >
                            <JustifyIcon />
                        </EditorButton>
                    </ToolbarGroup>
                    </>
                )}

                <div className="mw-tiptap-toolbar-separator" />

                <ToolbarGroup>
                    <select className="mw-tiptap-format-select" aria-label="Text color"
                        value={formatting.textColor} disabled={!formatting.canTextColor}
                        onChange={event => applyPreset(editor, 'mwTextColor', 'color', event.target.value)}>
                        <option value="" disabled>Text color / mixed</option>
                        <option value="default">Default</option>
                        <option value="black">Black</option>
                        <option value="red">Red</option>
                        <option value="blue">Blue</option>
                        <option value="green">Green</option>
                        <option value="purple">Purple</option>
                    </select>
                    <select className="mw-tiptap-format-select" aria-label="Font size"
                        value={formatting.fontSize} disabled={!formatting.canFontSize}
                        onChange={event => applyPreset(editor, 'mwFontSize', 'font-size', event.target.value)}>
                        <option value="" disabled>Font size / mixed</option>
                        <option value="default">Default</option>
                        <option value="12px">12 px</option>
                        <option value="16px">16 px</option>
                        <option value="20px">20 px</option>
                        <option value="24px">24 px</option>
                    </select>
                    <select className="mw-tiptap-format-select" aria-label="Font family"
                        value={formatting.fontFamily} disabled={!formatting.canFontFamily}
                        onChange={event => applyPreset(editor, 'mwFontFamily', 'font-family', event.target.value)}>
                        <option value="" disabled>Font family / mixed</option>
                        <option value="default">Default</option>
                        <option value="sans-serif">Sans serif</option>
                        <option value="serif">Serif</option>
                        <option value="monospace">Monospace</option>
                    </select>
                </ToolbarGroup>

                <div className="mw-tiptap-toolbar-separator" />

                <ToolbarGroup>
                    <EditorButton
                        active={formatting.link}
                        disabled={!formatting.canLink}
                        onMouseDown={event => event.preventDefault()}
                        tooltip="Insert or Edit Link"
                        onClick={() => { if (canEditLink(editor)) setLinkDialogOpen(true) }}
                    >
                        <LinkIcon />
                    </EditorButton>

                    <EditorButton
                        disabled={!formatting.canUnlink}
                        onMouseDown={event => event.preventDefault()}
                        tooltip="Remove Link"
                        onClick={() => {
                            if (editor.isEditable && editor.isActive('link') && editor.can().unsetLink()) {
                                editor.chain().focus().unsetLink().run()
                            }
                        }}
                    >
                        <UnlinkIcon />
                    </EditorButton>
                </ToolbarGroup>

                <div className="mw-tiptap-toolbar-separator" />

                <ToolbarGroup>
                    <EditorButton
                        active={formatting.blockquote}
                        disabled={!formatting.canBlockquote}
                        onMouseDown={event => event.preventDefault()}
                        tooltip="Blockquote"
                        onClick={() =>
                            editor
                                .chain()
                                .focus()
                                .toggleBlockquote()
                                .run()
                        }
                    >
                        <QuoteIcon />
                    </EditorButton>

                    <EditorButton
                        tooltip="Horizontal Rule"
                        disabled={!formatting.canHorizontalRule}
                        onMouseDown={event => event.preventDefault()}
                        onClick={() =>
                            editor
                                .chain()
                                .focus()
                                .setHorizontalRule()
                                .run()
                        }
                    >
                        <HorizontalRuleIcon />
                    </EditorButton>
                </ToolbarGroup>

                <div className="mw-tiptap-toolbar-separator" />

                <ToolbarGroup>
                    <EditorButton
                        tooltip="Clear Formatting"
                        disabled={!formatting.canClear}
                        onMouseDown={event => event.preventDefault()}
                        onClick={clearFormatting}
                    >
                        <ClearIcon />
                    </EditorButton>

                    <EditorButton
                        tooltip="Undo"
                        disabled={!editor.can().undo()}
                        onClick={() =>
                            editor
                                .chain()
                                .focus()
                                .undo()
                                .run()
                        }
                    >
                        <UndoIcon />
                    </EditorButton>

                    <EditorButton
                        tooltip="Redo"
                        disabled={!editor.can().redo()}
                        onClick={() =>
                            editor
                                .chain()
                                .focus()
                                .redo()
                                .run()
                        }
                    >
                        <RedoIcon />
                    </EditorButton>
                </ToolbarGroup>
            </div>

                    {isInsideTable && (
                        <TableContextualToolbar
                            editor={editor}
                        />
                    )}
                </>
            )}

            <LinkDialog
                editor={editor}
                open={linkDialogOpen}
                onClose={() => setLinkDialogOpen(false)}
            />

            <ImageDialog
                editor={editor}
                open={imageDialogOpen}
                onClose={() => setImageDialogOpen(false)}
                uploadUrl={imageUploadUrl}
                onImageUpload={onImageUpload}
            />

            <VideoDialog
                editor={editor}
                open={videoDialogOpen}
                onClose={() => setVideoDialogOpen(false)}
            />

            <TableDialog
                editor={editor}
                open={tableDialogOpen}
                onClose={() => setTableDialogOpen(false)}
            />

            <NewsBlockDialog
                editor={editor}
                open={newsBlockDialogOpen}
                onClose={() =>
                    setNewsBlockDialogOpen(
                        false
                    )
                }
                onNewsSearch={
                    onNewsSearch
                }
            />
        </>
    )
}