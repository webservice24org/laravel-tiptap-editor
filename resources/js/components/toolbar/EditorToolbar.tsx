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
import LinkDialog from '../dialogs/LinkDialog'
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
                        active={editor.isActive('bulletList')}
                        tooltip="Bullet List"
                        onClick={() =>
                            editor
                                .chain()
                                .focus()
                                .toggleBulletList()
                                .run()
                        }
                    >
                        <BulletListIcon />
                    </EditorButton>

                    <EditorButton
                        active={editor.isActive('orderedList')}
                        tooltip="Ordered List"
                        onClick={() =>
                            editor
                                .chain()
                                .focus()
                                .toggleOrderedList()
                                .run()
                        }
                    >
                        <OrderedListIcon />
                    </EditorButton>
                </ToolbarGroup>

                {!isInsideTable && (
                    <>
                    <div className="mw-tiptap-toolbar-separator" />

                    <ToolbarGroup>
                        <EditorButton
                            active={editor.isActive({
                                textAlign: 'left',
                            })}
                            tooltip="Align Left"
                            onClick={() =>
                                editor
                                    .chain()
                                    .focus()
                                    .setTextAlign('left')
                                    .run()
                            }
                        >
                            <AlignLeftIcon />
                        </EditorButton>

                        <EditorButton
                            active={editor.isActive({
                                textAlign: 'center',
                            })}
                            tooltip="Align Center"
                            onClick={() =>
                                editor
                                    .chain()
                                    .focus()
                                    .setTextAlign('center')
                                    .run()
                            }
                        >
                            <AlignCenterIcon />
                        </EditorButton>

                        <EditorButton
                            active={editor.isActive({
                                textAlign: 'right',
                            })}
                            tooltip="Align Right"
                            onClick={() =>
                                editor
                                    .chain()
                                    .focus()
                                    .setTextAlign('right')
                                    .run()
                            }
                        >
                            <AlignRightIcon />
                        </EditorButton>

                        <EditorButton
                            active={editor.isActive({
                                textAlign: 'justify',
                            })}
                            tooltip="Justify"
                            onClick={() =>
                                editor
                                    .chain()
                                    .focus()
                                    .setTextAlign('justify')
                                    .run()
                            }
                        >
                            <JustifyIcon />
                        </EditorButton>
                    </ToolbarGroup>
                    </>
                )}

                <div className="mw-tiptap-toolbar-separator" />

                <ToolbarGroup>
                    <EditorButton
                        active={editor.isActive('link')}
                        tooltip="Insert or Edit Link"
                        onClick={() => setLinkDialogOpen(true)}
                    >
                        <LinkIcon />
                    </EditorButton>

                    <EditorButton
                        disabled={!editor.isActive('link')}
                        tooltip="Remove Link"
                        onClick={() =>
                            editor
                                .chain()
                                .focus()
                                .extendMarkRange('link')
                                .unsetLink()
                                .run()
                        }
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