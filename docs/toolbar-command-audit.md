# 11.2F.3A — Toolbar architecture and command audit

Baseline: `ecc2b22f2a7a5e89e62d382006d77b224f5e7019`, F2G accepted. Scope: source audit and regression inventory only; no runtime behavior changes. The 15 audited source files were compared with their embedded source content in the accepted Ubuntu archive (line endings normalized). The snapshot records source observations, not desired behavior. The 20 automated tests validate inventory extraction and drift detection, not execution of ProseMirror commands or browser behavior.

## Architecture

`TiptapEditor` owns Visual/Code state, raw source HTML and the Tiptap instance. `createEditorExtensions` installs StarterKit (heading 1–3 and link configuration), TextAlign for heading/paragraph, Subscript, Superscript, ImageFigure, VideoEmbed, NewsBlock and custom Table, TableRow, TableHeader and TableCell. `EditorToolbar` owns dialog open state and queries table membership with `useEditorState`. `EditorButton` forwards button props, applies active styling, type=button, tooltip/label and disabled. `FormatDropdown` reads heading state and issues block commands. `TableContextualToolbar` subscribes to table attributes and renders only when Visual mode and table membership are true. `Dialog` is the shared backdrop/escape handler. Client sanitization surrounds visual updates and Visual/Code conversion. Parent value changes can replace content.

## Command matrix

All direct toolbar chain handlers invoke `chain().focus()...run()`; a return value is not inspected in the handlers. The JSON inventory contains the exact source expressions, guards, options, subscriptions, helper bodies and component bindings.

| Surface | Control(s) | Operation | Observed state/availability |
|---|---|---|---|
| Main | Add image, Add video, Insert table, Insert news block | Open ImageDialog, VideoDialog, TableDialog, NewsBlockDialog | No disabled or mode guard in this row |
| Main | Visual editor, HTML code editor | Optional onModeChange callback | aria-pressed and active class by mode |
| Format dropdown | Paragraph, Heading 1/2/3 | setParagraph / setHeading(level) | getCurrentFormat queries heading level, otherwise paragraph; no disabled guard; always rendered |
| Text | Bold, Italic, Underline, Strike, Subscript, Superscript | toggleBold / toggleItalic / toggleUnderline / toggleStrike / toggleSubscript / toggleSuperscript | isActive per mark; no can check |
| Lists | Bullet List, Ordered List | toggleBulletList / toggleOrderedList | isActive; no can check |
| Align | Align Left, Align Center, Align Right, Justify | setTextAlign(left/center/right/justify) | isActive({textAlign}); hidden inside table; no can check |
| Link | Insert or Edit Link | Open LinkDialog | isActive(link); no can check |
| Link | Remove Link | extendMarkRange(link), unsetLink | disabled when !isActive(link) |
| Blocks | Blockquote | toggleBlockquote | isActive; no can check |
| Blocks | Horizontal Rule | setHorizontalRule | No can check |
| Formatting | Clear Formatting | clearNodes, unsetAllMarks in one chain | No can check; check document structure and selection semantics |
| History | Undo, Redo | undo / redo | disabled via !can().undo() / !can().redo() |
| Table | Row Above, Row Below, Delete Row | addRowBefore / addRowAfter / deleteRow | matching can checks |
| Table | Column Left, Column Right, Delete Column | addColumnBefore / addColumnAfter / deleteColumn | matching can checks |
| Table | 4 horizontal and 3 vertical alignment buttons | updateCurrentTableCell -> updateAttributes(tableHeader or tableCell) | class driven by subscribed attributes; no can check |
| Table | Cell background color, Clear Color, Cell text color, Clear Text | updateCurrentTableCell with color or null | color input subscribed values, defaults white/black; no can check |
| Table | Merge, Split | mergeCells / splitCell | matching can checks |
| Table | Header Row, Header Column, Header Cell | toggleHeaderRow / toggleHeaderColumn / toggleHeaderCell | no can check |
| Table | Properties | Opens TablePropertiesDialog | no can check |
| Table | Delete Table | deleteTable | no can check |

Main: 25 buttons (6 always rendered + 19 Visual-only); format dropdown: 1 select with four options; contextual table: 24 (22 buttons + 2 color inputs). Total 50 controls, 4 options, 46 `.run()` call sites across audited sources (main 18, dropdown 4, table 14, dialogs 10). Table controls inherit the mount guard from the parent, not each child. Dialog internal form controls are not included in the toolbar count.

### Dialog routes

- LinkDialog reads selection/text/link attributes on opening; editing an existing link extends the range and sets the link; selected text either gets setLink or is replaced using a text node with link marks; empty selection inserts linked text; removal extends and unsets. URL validation remains part of its existing implementation.
- ImageDialog: insertImageFigure after upload/validation. VideoDialog: insertVideoEmbed. TableDialog: insertTable. NewsBlockDialog: optional onSubmit or insertNewsBlock. TablePropertiesDialog: updateAttributes('table', ...) after numeric bounds checks. These paths are recorded, not exercised here.

## Findings and planned regression targets

| ID | Source observation / risk | Required next action | Owner |
|---|---|---|---|
| T01 | Main state subscription selects only isInsideTable. Other isActive and can reads depend on render. Tiptap 3 default transaction rerender is disabled. Selection-only changes may leave stale state. | Browser reproduce mark/history/heading selection transitions, then subscribe to necessary state. | F3B/F3G |
| T02 | Most formatting controls have no matching can guard; command outcomes ignored. | Test unsupported selections and command applicability, then add consistent capability policy. | F3B–F3F |
| T03 | getCurrentFormat returns paragraph for nonheading blocks, including mixed selections. | Define expected display for lists, quotes, other blocks and mixed selection. | F3C |
| T04 | Top format/insert controls remain visible and actionable in Code mode while editor content is hidden. | Reproduce and ensure source buffer and hidden editor cannot diverge through these controls. | F6 |
| T05 | Inactive EditorButton omits aria-pressed; shared groups have optional labels; no explicit toolbar arrow-key navigation policy. | Distinguish toggles from actions, verify focus/keyboard/ARIA. | F3G/F7 |
| T06 | Dialogs access current selection at command time; no explicit bookmark strategy in toolbar. Dialog shared title ID and no explicit focus trap/restore in Dialog. | Verify selection after opening, closing, asynchronous uploads and multiple instances. | F3E/F4/F5/F7 |
| T07 | StarterKit includes inline code and codeBlock but sanitizeHtml ALLOWED_TAGS excludes code/pre. | Verify HTML round-trip; decide whether to support or intentionally disable both consistently, preserving security. | F3C/F6 |
| T08 | Table state subscription includes cell attrs but capability and mixed-cell selection semantics need separate coverage. | Cell/header and multi-cell alignment/color/merge tests. | F5 |
| T09 | General indentation, text color, font size/family and highlight controls are absent from the audited toolbar/extension factory. Table-specific color exists. | Do not treat these as existing supported features; discuss feature additions separately. | F3D/F3E |
| T10 | Existing format, mark and history behavior is not tested exhaustively by F2E smoke tests. | Add actual browser scenarios and check sanitized callback payloads. | F3B–F3H |

These are static observations or risk hypotheses, not reproduced browser failures. No sanitizer relaxation, new extension, or command refactor is authorized by this audit. Existing PHP and consumer workflows remain unchanged.

References for interpretation: Tiptap v3 What's New (https://tiptap.dev/docs/resources/whats-new); Custom menus (https://tiptap.dev/docs/editor/getting-started/style-editor/custom-menus); StarterKit (https://tiptap.dev/docs/editor/extensions/functionality/starterkit).

## Reproduction and CI

Run `npm run test:toolbar` and `npm run check:toolbar`. The TypeScript AST reader checks the three toolbar surfaces and selected command/state/binding expressions across 15 source files against `tests/Toolbar/command-inventory.json`. It normalizes CRLF but intentionally flags formatting changes within recorded expressions; it is not a semantic equivalence checker and does not discover arbitrary dynamically rendered controls. Inventory changes require explicit review alongside runtime fixes, not automatic snapshot regeneration. The Node matrix writes `toolbar-tests.log` and `toolbar-summary.json` after the strict dependency install. Reports are source evidence only. Do not publish any archive. F3B starts real formatting regression.
