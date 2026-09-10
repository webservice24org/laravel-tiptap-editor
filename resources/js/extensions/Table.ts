import {
    Table,
} from '@tiptap/extension-table'

type TableWidthMode =
    | 'auto'
    | '50'
    | '75'
    | 'full'

type TableAlignment =
    | 'left'
    | 'center'
    | 'right'

type TableBorderStyle =
    | 'solid'
    | 'dashed'
    | 'dotted'

const CustomTable =
    Table.extend({
        addAttributes() {
            return {
                ...this.parent?.(),

                widthMode: {
                    default:
                        'full',

                    parseHTML:
                        (
                            element
                        ): TableWidthMode => {
                            const value =
                                element.getAttribute(
                                    'data-width-mode'
                                )

                            if (
                                value === 'auto' ||
                                value === '50' ||
                                value === '75'
                            ) {
                                return value
                            }

                            return 'full'
                        },

                    renderHTML:
                        (
                            attributes
                        ) => {
                            const widthMode =
                                (
                                    attributes.widthMode ??
                                    'full'
                                ) as TableWidthMode

                            const tableAlign =
                                (
                                    attributes.tableAlign ??
                                    'center'
                                ) as TableAlignment

                            const borderColor =
                                String(
                                    attributes.borderColor ??
                                    '#d4d4d4'
                                )

                            const borderWidth =
                                Math.max(
                                    0,
                                    Math.min(
                                        10,
                                        Number(
                                            attributes.borderWidth ??
                                            1
                                        )
                                    )
                                )

                            const borderStyle =
                                (
                                    attributes.borderStyle ??
                                    'solid'
                                ) as TableBorderStyle

                            const cellPadding =
                                Math.max(
                                    0,
                                    Math.min(
                                        40,
                                        Number(
                                            attributes.cellPadding ??
                                            10
                                        )
                                    )
                                )

                            const width =
                                widthMode ===
                                'auto'
                                    ? 'auto'
                                    : widthMode ===
                                        '50'
                                      ? '50%'
                                      : widthMode ===
                                          '75'
                                        ? '75%'
                                        : '100%'

                            const margins =
                                tableAlign ===
                                'left'
                                    ? [
                                          'margin-left: 0',
                                          'margin-right: auto',
                                      ]
                                    : tableAlign ===
                                        'right'
                                      ? [
                                            'margin-left: auto',
                                            'margin-right: 0',
                                        ]
                                      : [
                                            'margin-left: auto',
                                            'margin-right: auto',
                                        ]

                            const styles = [
                                `width: ${width}`,
                                ...margins,
                                `--mw-table-border-color: ${borderColor}`,
                                `--mw-table-border-width: ${borderWidth}px`,
                                `--mw-table-border-style: ${borderStyle}`,
                                `--mw-table-cell-padding: ${cellPadding}px`,
                            ]

                            return {
                                'data-width-mode':
                                    widthMode,

                                'data-table-align':
                                    tableAlign,

                                'data-border-color':
                                    borderColor,

                                'data-border-width':
                                    borderWidth,

                                'data-border-style':
                                    borderStyle,

                                'data-cell-padding':
                                    cellPadding,

                                'data-mw-table-properties':
                                    'true',

                                style:
                                    `${styles.join('; ')};`,
                            }
                        },
                },

                tableAlign: {
                    default:
                        'center',

                    parseHTML:
                        (
                            element
                        ): TableAlignment => {
                            const value =
                                element.getAttribute(
                                    'data-table-align'
                                )

                            if (
                                value === 'left' ||
                                value === 'right'
                            ) {
                                return value
                            }

                            return 'center'
                        },

                    renderHTML:
                        () => ({}),
                },

                borderColor: {
                    default:
                        '#d4d4d4',

                    parseHTML:
                        (
                            element
                        ) =>
                            element.getAttribute(
                                'data-border-color'
                            ) ??
                            '#d4d4d4',

                    renderHTML:
                        () => ({}),
                },

                borderWidth: {
                    default:
                        1,

                    parseHTML:
                        (
                            element
                        ) => {
                            const value =
                                Number(
                                    element.getAttribute(
                                        'data-border-width'
                                    )
                                )

                            return Number.isFinite(
                                value
                            )
                                ? value
                                : 1
                        },

                    renderHTML:
                        () => ({}),
                },

                borderStyle: {
                    default:
                        'solid',

                    parseHTML:
                        (
                            element
                        ): TableBorderStyle => {
                            const value =
                                element.getAttribute(
                                    'data-border-style'
                                )

                            if (
                                value === 'dashed' ||
                                value === 'dotted'
                            ) {
                                return value
                            }

                            return 'solid'
                        },

                    renderHTML:
                        () => ({}),
                },

                cellPadding: {
                    default:
                        10,

                    parseHTML:
                        (
                            element
                        ) => {
                            const value =
                                Number(
                                    element.getAttribute(
                                        'data-cell-padding'
                                    )
                                )

                            return Number.isFinite(
                                value
                            )
                                ? value
                                : 10
                        },

                    renderHTML:
                        () => ({}),
                },
            }
        },
    })

export default CustomTable
