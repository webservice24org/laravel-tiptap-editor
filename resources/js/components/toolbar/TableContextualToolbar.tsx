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
                    onClick={() =>
                        editor
                            .chain()
                            .focus()
                            .addRowBefore()
                            .run()
                    }
                    disabled={
                        !editor
                            .can()
                            .addRowBefore()
                    }
                >
                    <RowAboveIcon />
                    <span>Row Above</span>
                </button>

                <button
                    type="button"
                    onClick={() =>
                        editor
                            .chain()
                            .focus()
                            .addRowAfter()
                            .run()
                    }
                    disabled={
                        !editor
                            .can()
                            .addRowAfter()
                    }
                >
                    <RowBelowIcon />
                    <span>Row Below</span>
                </button>

                <button
                    type="button"
                    onClick={() =>
                        editor
                            .chain()
                            .focus()
                            .deleteRow()
                            .run()
                    }
                    disabled={
                        !editor
                            .can()
                            .deleteRow()
                    }
                >
                    <DeleteRowIcon />
                    <span>Delete Row</span>
                </button>

                <div className="mw-table-toolbar-divider" />

                <button
                    type="button"
                    onClick={() =>
                        editor
                            .chain()
                            .focus()
                            .addColumnBefore()
                            .run()
                    }
                    disabled={
                        !editor
                            .can()
                            .addColumnBefore()
                    }
                >
                    <ColumnLeftIcon />
                    <span>Column Left</span>
                </button>

                <button
                    type="button"
                    onClick={() =>
                        editor
                            .chain()
                            .focus()
                            .addColumnAfter()
                            .run()
                    }
                    disabled={
                        !editor
                            .can()
                            .addColumnAfter()
                    }
                >
                    <ColumnRightIcon />
                    <span>Column Right</span>
                </button>

                <button
                    type="button"
                    onClick={() =>
                        editor
                            .chain()
                            .focus()
                            .deleteColumn()
                            .run()
                    }
                    disabled={
                        !editor
                            .can()
                            .deleteColumn()
                    }
                >
                    <DeleteColumnIcon />
                    <span>Delete Column</span>
                </button>

                <div className="mw-table-toolbar-divider" />

                <div className="mw-table-toolbar-group">
                    <button
                        type="button"
                        title="Align cell left"
                        className={
                            tableState.textAlign ===
                            'left'
                                ? 'is-active'
                                : undefined
                        }
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
                        title="Align cell center"
                        className={
                            tableState.textAlign ===
                            'center'
                                ? 'is-active'
                                : undefined
                        }
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
                        title="Align cell right"
                        className={
                            tableState.textAlign ===
                            'right'
                                ? 'is-active'
                                : undefined
                        }
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
                        title="Justify cell text"
                        className={
                            tableState.textAlign ===
                            'justify'
                                ? 'is-active'
                                : undefined
                        }
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
                        title="Align top"
                        className={
                            tableState.verticalAlign ===
                            'top'
                                ? 'is-active'
                                : undefined
                        }
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
                        title="Align middle"
                        className={
                            tableState.verticalAlign ===
                            'middle'
                                ? 'is-active'
                                : undefined
                        }
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
                        title="Align bottom"
                        className={
                            tableState.verticalAlign ===
                            'bottom'
                                ? 'is-active'
                                : undefined
                        }
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
                    onClick={() =>
                        editor
                            .chain()
                            .focus()
                            .mergeCells()
                            .run()
                    }
                    disabled={
                        !editor
                            .can()
                            .mergeCells()
                    }
                >
                    <MergeCellsIcon />
                    <span>Merge</span>
                </button>

                <button
                    type="button"
                    onClick={() =>
                        editor
                            .chain()
                            .focus()
                            .splitCell()
                            .run()
                    }
                    disabled={
                        !editor
                            .can()
                            .splitCell()
                    }
                >
                    <SplitCellIcon />
                    <span>Split</span>
                </button>

                <div className="mw-table-toolbar-divider" />

                <button
                    type="button"
                    onClick={() =>
                        editor
                            .chain()
                            .focus()
                            .toggleHeaderRow()
                            .run()
                    }
                >
                    <HeaderRowIcon />
                    <span>Header Row</span>
                </button>

                <button
                    type="button"
                    onClick={() =>
                        editor
                            .chain()
                            .focus()
                            .toggleHeaderColumn()
                            .run()
                    }
                >
                    <HeaderColumnIcon />
                    <span>Header Column</span>
                </button>

                <button
                    type="button"
                    onClick={() =>
                        editor
                            .chain()
                            .focus()
                            .toggleHeaderCell()
                            .run()
                    }
                >
                    <HeaderCellIcon />
                    <span>Header Cell</span>
                </button>

                <div className="mw-table-toolbar-divider" />

                <button
                    type="button"
                    className="mw-table-toolbar-properties"
                    onClick={() =>
                        setPropertiesOpen(
                            true
                        )
                    }
                >
                    <PropertiesIcon />
                    <span>Properties</span>
                </button>

                <button
                    type="button"
                    className="mw-table-toolbar-danger"
                    onClick={() =>
                        editor
                            .chain()
                            .focus()
                            .deleteTable()
                            .run()
                    }
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
