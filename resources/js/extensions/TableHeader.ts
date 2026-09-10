import {
    mergeAttributes,
} from '@tiptap/core'

import {
    TableHeader,
} from '@tiptap/extension-table'

const CustomTableHeader =
    TableHeader.extend({
        addAttributes() {
            return {
                ...this.parent?.(),

                textAlign: {
                    default:
                        null,

                    parseHTML:
                        (
                            element
                        ) =>
                            element.style
                                .textAlign ||
                            null,
                },

                verticalAlign: {
                    default:
                        null,

                    parseHTML:
                        (
                            element
                        ) =>
                            element.style
                                .verticalAlign ||
                            null,
                },

                backgroundColor: {
                    default:
                        null,

                    parseHTML:
                        (
                            element
                        ) =>
                            element.style
                                .backgroundColor ||
                            null,
                },

                textColor: {
                    default:
                        null,

                    parseHTML:
                        (
                            element
                        ) =>
                            element.style
                                .color ||
                            null,
                },
            }
        },

        renderHTML({
            HTMLAttributes,
        }) {
            const {
                textAlign,
                verticalAlign,
                backgroundColor,
                textColor,
                style,
                ...rest
            } =
                HTMLAttributes

            const styles = [
                style,

                textAlign
                    ? `text-align: ${textAlign}`
                    : '',

                verticalAlign
                    ? `vertical-align: ${verticalAlign}`
                    : '',

                backgroundColor
                    ? `background-color: ${backgroundColor}`
                    : '',

                textColor
                    ? `color: ${textColor}`
                    : '',
            ]
                .filter(Boolean)
                .join('; ')

            return [
                'th',

                mergeAttributes(
                    this.options
                        .HTMLAttributes,

                    rest,

                    styles
                        ? {
                              style:
                                  `${styles};`,
                          }
                        : {}
                ),

                0,
            ]
        },
    })

export default CustomTableHeader
