import {
    useEditorState,
} from '@tiptap/react'

import type {
    Editor,
} from '@tiptap/react'

import {
    useState,
} from 'react'

import TablePropertiesDialog
    from '../dialogs/TablePropertiesDialog'

import {
    AlignBottomIcon,
    AlignCenterIcon,
    AlignJustifyIcon,
    AlignLeftIcon,
    AlignMiddleIcon,
    AlignRightIcon,
    AlignTopIcon,
    ClearColorIcon,
    ClearTextColorIcon,
    ColumnLeftIcon,
    ColumnRightIcon,
    DeleteColumnIcon,
    DeleteRowIcon,
    DeleteTableIcon,
    HeaderCellIcon,
    HeaderColumnIcon,
    HeaderRowIcon,
    MergeCellsIcon,
    PropertiesIcon,
    RowAboveIcon,
    RowBelowIcon,
    SplitCellIcon,
} from '../icons/TableToolbarIcons'

interface TableContextualToolbarProps {
    editor: Editor
}

type TableCellAttributes = {
    textAlign?: string | null
    verticalAlign?: string | null
    backgroundColor?: string | null
    textColor?: string | null
}

type TableAction =
    | 'addRowBefore'
    | 'addRowAfter'
    | 'deleteRow'
    | 'addColumnBefore'
    | 'addColumnAfter'
    | 'deleteColumn'
    | 'mergeCells'
    | 'splitCell'
    | 'toggleHeaderRow'
    | 'toggleHeaderColumn'
    | 'toggleHeaderCell'
    | 'deleteTable'

function canEditTable(editor: Editor): boolean {
    return !editor.isDestroyed && editor.isEditable && editor.isActive('table')
}

function canTableAction(editor: Editor, action: TableAction): boolean {
    return canEditTable(editor) && editor.can()[action]()
}

function applyTableAction(editor: Editor, action: TableAction): boolean {
    if (!canTableAction(editor, action)) return false
    return editor.chain().focus()[action]().run()
}

export default function TableContextualToolbar({
    editor,
}: TableContextualToolbarProps) {
    const [
        propertiesOpen,
        setPropertiesOpen,
    ] =
        useState(false)

    const tableState =
        useEditorState({
            editor,

            selector: ({
                editor: currentEditor,
            }) => {
                const isHeader =
                    currentEditor.isActive(
                        'tableHeader'
                    )

                const cellAttributes =
                    (
                        isHeader
                            ? currentEditor.getAttributes(
                                  'tableHeader'
                              )
                            : currentEditor.getAttributes(
                                  'tableCell'
                              )
                    ) as TableCellAttributes

                return {
                    canEdit: canEditTable(currentEditor),
                    addRowBefore: canTableAction(currentEditor, 'addRowBefore'),
                    addRowAfter: canTableAction(currentEditor, 'addRowAfter'),
                    deleteRow: canTableAction(currentEditor, 'deleteRow'),
                    addColumnBefore: canTableAction(currentEditor, 'addColumnBefore'),
                    addColumnAfter: canTableAction(currentEditor, 'addColumnAfter'),
                    deleteColumn: canTableAction(currentEditor, 'deleteColumn'),
                    mergeCells: canTableAction(currentEditor, 'mergeCells'),
                    splitCell: canTableAction(currentEditor, 'splitCell'),
                    toggleHeaderRow: canTableAction(currentEditor, 'toggleHeaderRow'),
                    toggleHeaderColumn: canTableAction(currentEditor, 'toggleHeaderColumn'),
                    toggleHeaderCell: canTableAction(currentEditor, 'toggleHeaderCell'),
                    deleteTable: canTableAction(currentEditor, 'deleteTable'),
                    textAlign:
                        cellAttributes.textAlign ??
                        null,

                    verticalAlign:
                        cellAttributes.verticalAlign ??
                        null,

                    backgroundColor:
                        cellAttributes.backgroundColor ??
                        null,

                    textColor:
                        cellAttributes.textColor ??
                        null,
                }
            },
        })

    const updateCurrentTableCell = (
        attributes: Record<
            string,
            unknown
        >
    ) => {
        if (!canEditTable(editor)) return
        if (
            editor.isActive(
                'tableHeader'
            )
        ) {
            editor
                .chain()
                .focus()
                .updateAttributes(
                    'tableHeader',
                    attributes
                )
                .run()

            return
        }

        editor
            .chain()
            .focus()
            .updateAttributes(
                'tableCell',
                attributes
            )
            .run()
    }

    return (
        <>
            <div
                className="mw-table-toolbar"
                role="toolbar"
                aria-label="Table editing controls"
            >
                <button
                    type="button"
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => applyTableAction(editor, 'addRowBefore')}
                    disabled={!tableState.addRowBefore}
                >
                    <RowAboveIcon />
                    <span>Row Above</span>
                </button>

                <button
                    type="button"
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => applyTableAction(editor, 'addRowAfter')}
                    disabled={!tableState.addRowAfter}
                >
                    <RowBelowIcon />
                    <span>Row Below</span>
                </button>

                <button
                    type="button"
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => applyTableAction(editor, 'deleteRow')}
                    disabled={!tableState.deleteRow}
                >
                    <DeleteRowIcon />
                    <span>Delete Row</span>
                </button>

                <div className="mw-table-toolbar-divider" />

                <button
                    type="button"
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => applyTableAction(editor, 'addColumnBefore')}
                    disabled={!tableState.addColumnBefore}
                >
                    <ColumnLeftIcon />
                    <span>Column Left</span>
                </button>

                <button
                    type="button"
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => applyTableAction(editor, 'addColumnAfter')}
                    disabled={!tableState.addColumnAfter}
                >
                    <ColumnRightIcon />
                    <span>Column Right</span>
                </button>

                <button
                    type="button"
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => applyTableAction(editor, 'deleteColumn')}
                    disabled={!tableState.deleteColumn}
                >
                    <DeleteColumnIcon />
                    <span>Delete Column</span>
                </button>

                <div className="mw-table-toolbar-divider" />

                <div className="mw-table-toolbar-group">
                    <button
                        type="button"
                        onMouseDown={event => event.preventDefault()}
                        title="Align cell left"
                        className={
                            tableState.textAlign ===
                            'left'
                                ? 'is-active'
                                : undefined
                        }
                        aria-pressed={tableState.textAlign === 'left'}
                        disabled={!tableState.canEdit}
                        onClick={() =>
                            updateCurrentTableCell({
                                textAlign:
                                    'left',
                            })
                        }
                    >
                        <AlignLeftIcon />
                        <span>Left</span>
                    </button>

                    <button
                        type="button"
                        onMouseDown={event => event.preventDefault()}
                        title="Align cell center"
                        className={
                            tableState.textAlign ===
                            'center'
                                ? 'is-active'
                                : undefined
                        }
                        aria-pressed={tableState.textAlign === 'center'}
                        disabled={!tableState.canEdit}
                        onClick={() =>
                            updateCurrentTableCell({
                                textAlign:
                                    'center',
                            })
                        }
                    >
                        <AlignCenterIcon />
                        <span>Center</span>
                    </button>

                    <button
                        type="button"
                        onMouseDown={event => event.preventDefault()}
                        title="Align cell right"
                        className={
                            tableState.textAlign ===
                            'right'
                                ? 'is-active'
                                : undefined
                        }
                        aria-pressed={tableState.textAlign === 'right'}
                        disabled={!tableState.canEdit}
                        onClick={() =>
                            updateCurrentTableCell({
                                textAlign:
                                    'right',
                            })
                        }
                    >
                        <AlignRightIcon />
                        <span>Right</span>
                    </button>

                    <button
                        type="button"
                        onMouseDown={event => event.preventDefault()}
                        title="Justify cell text"
                        className={
                            tableState.textAlign ===
                            'justify'
                                ? 'is-active'
                                : undefined
                        }
                        aria-pressed={tableState.textAlign === 'justify'}
                        disabled={!tableState.canEdit}
                        onClick={() =>
                            updateCurrentTableCell({
                                textAlign:
                                    'justify',
                            })
                        }
                    >
                        <AlignJustifyIcon />
                        <span>Justify</span>
                    </button>
                </div>

                <div className="mw-table-toolbar-divider" />

                <div className="mw-table-toolbar-group">
                    <button
                        type="button"
                        onMouseDown={event => event.preventDefault()}
                        title="Align top"
                        className={
                            tableState.verticalAlign ===
                            'top'
                                ? 'is-active'
                                : undefined
                        }
                        aria-pressed={tableState.verticalAlign === 'top'}
                        disabled={!tableState.canEdit}
                        onClick={() =>
                            updateCurrentTableCell({
                                verticalAlign:
                                    'top',
                            })
                        }
                    >
                        <AlignTopIcon />
                        <span>Top</span>
                    </button>

                    <button
                        type="button"
                        onMouseDown={event => event.preventDefault()}
                        title="Align middle"
                        className={
                            tableState.verticalAlign ===
                            'middle'
                                ? 'is-active'
                                : undefined
                        }
                        aria-pressed={tableState.verticalAlign === 'middle'}
                        disabled={!tableState.canEdit}
                        onClick={() =>
                            updateCurrentTableCell({
                                verticalAlign:
                                    'middle',
                            })
                        }
                    >
                        <AlignMiddleIcon />
                        <span>Middle</span>
                    </button>

                    <button
                        type="button"
                        onMouseDown={event => event.preventDefault()}
                        title="Align bottom"
                        className={
                            tableState.verticalAlign ===
                            'bottom'
                                ? 'is-active'
                                : undefined
                        }
                        aria-pressed={tableState.verticalAlign === 'bottom'}
                        disabled={!tableState.canEdit}
                        onClick={() =>
                            updateCurrentTableCell({
                                verticalAlign:
                                    'bottom',
                            })
                        }
                    >
                        <AlignBottomIcon />
                        <span>Bottom</span>
                    </button>
                </div>

                <div className="mw-table-toolbar-divider" />

                <label
                    className="mw-table-color-control"
                    title="Cell background color"
                >
                    <span>
                        Cell Color
                    </span>

                    <input
                        type="color"
                        disabled={!tableState.canEdit}
                        value={
                            tableState.backgroundColor ??
                            '#ffffff'
                        }
                        onChange={(
                            event
                        ) =>
                            updateCurrentTableCell({
                                backgroundColor:
                                    event
                                        .target
                                        .value,
                            })
                        }
                    />
                </label>

                <button
                    type="button"
                    onMouseDown={event => event.preventDefault()}
                    disabled={!tableState.canEdit}
                    onClick={() =>
                        updateCurrentTableCell({
                            backgroundColor:
                                null,
                        })
                    }
                >
                    <ClearColorIcon />
                    <span>Clear Color</span>
                </button>

                <div className="mw-table-toolbar-divider" />

                <label
                    className="mw-table-color-control"
                    title="Cell text color"
                >
                    <span>
                        Text
                    </span>

                    <input
                        type="color"
                        disabled={!tableState.canEdit}
                        value={
                            tableState.textColor ??
                            '#000000'
                        }
                        onChange={(
                            event
                        ) =>
                            updateCurrentTableCell({
                                textColor:
                                    event
                                        .target
                                        .value,
                            })
                        }
                    />
                </label>

                <button
                    type="button"
                    onMouseDown={event => event.preventDefault()}
                    disabled={!tableState.canEdit}
                    onClick={() =>
                        updateCurrentTableCell({
                            textColor:
                                null,
                        })
                    }
                >
                    <ClearTextColorIcon />
                    <span>Clear Text</span>
                </button>

                <div className="mw-table-toolbar-divider" />

                <button
                    type="button"
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => applyTableAction(editor, 'mergeCells')}
                    disabled={!tableState.mergeCells}
                >
                    <MergeCellsIcon />
                    <span>Merge</span>
                </button>

                <button
                    type="button"
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => applyTableAction(editor, 'splitCell')}
                    disabled={!tableState.splitCell}
                >
                    <SplitCellIcon />
                    <span>Split</span>
                </button>

                <div className="mw-table-toolbar-divider" />

                <button
                    type="button"
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => applyTableAction(editor, 'toggleHeaderRow')}
                    disabled={!tableState.toggleHeaderRow}
                >
                    <HeaderRowIcon />
                    <span>Header Row</span>
                </button>

                <button
                    type="button"
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => applyTableAction(editor, 'toggleHeaderColumn')}
                    disabled={!tableState.toggleHeaderColumn}
                >
                    <HeaderColumnIcon />
                    <span>Header Column</span>
                </button>

                <button
                    type="button"
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => applyTableAction(editor, 'toggleHeaderCell')}
                    disabled={!tableState.toggleHeaderCell}
                >
                    <HeaderCellIcon />
                    <span>Header Cell</span>
                </button>

                <div className="mw-table-toolbar-divider" />

                <button
                    type="button"
                    onMouseDown={event => event.preventDefault()}
                    className="mw-table-toolbar-properties"
                    disabled={!tableState.canEdit}
                    onClick={() => { if (canEditTable(editor)) setPropertiesOpen(true) }}
                >
                    <PropertiesIcon />
                    <span>Properties</span>
                </button>

                <button
                    type="button"
                    onMouseDown={event => event.preventDefault()}
                    className="mw-table-toolbar-danger"
                    onClick={() => applyTableAction(editor, 'deleteTable')}
                    disabled={!tableState.deleteTable}
                >
                    <DeleteTableIcon />
                    <span>Delete Table</span>
                </button>
            </div>

            <TablePropertiesDialog
                editor={editor}
                open={propertiesOpen}
                onClose={() =>
                    setPropertiesOpen(
                        false
                    )
                }
            />
        </>
    )
}
