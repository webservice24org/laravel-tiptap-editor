# 11.2F.3B — Text formatting regression

Baseline: accepted F3A commit 564a72c. The root dependency manifest and lockfile, build and package quality gates, PHP code, and both existing CI workflow configurations remain unchanged.

## Targeted implementation

- The main toolbar uses the existing `useEditorState` subscription to track the six inline marks and their `can().toggle…()` availability. It also tracks the existing table condition and clear-formatting chain availability. Commands are still executed through the original focus/command/run chains. Availability probes do not dispatch. Clear formatting retains its existing block reset plus mark removal semantics.
- Mouse down on these six buttons and Clear Formatting prevents focus theft; normal click and keyboard activation remain available. Touch behavior and broader toolbar focus/navigation are later acceptance work.
- `EditorButton` distinguishes an omitted active prop (ordinary action) from false (inactive toggle). The shared change also makes existing non-inline toggles expose false when their active prop is false; it does not make their state reactive. Broader toolbar state remains F3G.
- Both script marks are installed in this factory. Configure their schema exclusions explicitly so subscript and superscript cannot coexist on the same character during editor transactions. This is not a migration or a server-side sanitization rule for historic nested markup.
- No new format controls, changes to the sanitizer allowlist, changes to dialog behavior, or changes to table commands. Existing strong/b, em/i, u, s, sub and sup tags are retained by the client sanitizer.

## Reviewed inventory

50 controls, four dropdown options, 47 chain call sites (46 existing + one nondispatching availability chain), 15 audited sources. Inventory now records `onMouseDown`. Updated snapshot is reviewed, not automatically accepted during CI. Nine additional static tests verify six mark bindings, clear formatting wiring, toggle ARIA and script exclusion (29 total toolbar tests).

## Installed-package browser regression

Run the established consumer command after a fresh library build. The existing isolated consumers still install the archive with strict peer/engine checks and run their existing nine browser smoke check groups. The new fixture reset input and generation key exist only in the consumer app, never in the published library. `formatting.mjs` uses actual keyboard and toolbar UI actions, verifies selection, class and ARIA state, and compares DOM markup to sanitized controlled onChange HTML. It runs 22 named groups: six apply/remove, six collapsed stored-mark typing, six selection-only transitions without edits, combined marks/clear, mixed selection bold, script switching, and safe inline HTML round trip including remount. Each successful browser-summary.json contains these exact names under `formatting.checks`, and the runner rejects incomplete evidence. Both React 18.3.1 and 19.3.1 lanes are required. The consumer workflow already calls this runner, so no separate workflow is added. These checks verify enabled availability in the tested text contexts; unavailable contexts, keyboard accessibility, code blocks and broader state/selection scenarios remain later phases. No full XSS or backend validation is claimed.

## Local QA

1. Preview and install with the guarded installer. Stop on mismatch. Back up dist outside the project if needed.
2. Run `npm run test:toolbar` (29), `npm run check:toolbar`, `npm run typecheck`, `npm run build`.
3. Run `npm run test:consumer -- 18` and `npm run test:consumer -- 19` (network access required). Each should print 22 Formatting passed lines and the existing successful browser summary. If a test fails, send its exact error and preserved work/report directory logs. Do not change the expected inventory or skip a failing group.
4. Run `npm audit`, `npm audit --omit=dev`, and installer `--verify`. Stage only the listed payload paths and push. Require all three CI workflows green. Retain both React consumer artifacts and six Node artifacts for closure.

Preparation verified source and baseline checksums and executed static validators with Node 22.16.0/TypeScript 5.8.3. Registry DNS failure prevents fresh dependency installation, TS5.9.3 typecheck/build and browser execution here. The suspected original stale-state behavior is source-derived; it has not been reproduced in a live browser here. Actual browser and hosted acceptance remains pending. No publication or MWT project modifications.

## Fix 1 — deterministic browser fixture selection

Commit de32866 passed PHP and Node build workflows, but both React browser lanes timed out in the first Bold group while establishing the selection, before clicking Bold. The actual wrong selection was not logged. Replace center-of-editor click plus Home/Shift+End with exact native DOM Range selection in the single-paragraph fixture. Verify editor focus, both text offsets, selected text, and collapsed/noncollapsed state after native selection processing. The same helper positions collapsed cursors for typing and selection-only checks. Toolbar clicks, keyboard text insertion, all 22 named check groups, DOM and sanitized callback assertions, and all existing gates remain required. The helper does not access the editor instance or inject transactions. Failures now include fixture content, callback count, selection endpoints, focus and toolbar state in browser.log. Keyboard navigation coverage is not claimed from these range-based checks; broader keyboard and mouse selection regression remains scheduled for later phases. No production code or dependency changes.

## Fix 2 — script mark switching capability

On commit 316bdc8, both React browser lanes passed 20 of 22 formatting groups. The exact selection was focused and contained the subscript mark, but Superscript was disabled. Tiptap 3.32.0's `setMark` capability check rejects marks excluded by existing marks; its `unsetMark` does not mutate a normal `can()` transaction. Keep schema exclusion unchanged. Route the two toolbar actions through one shared chain that removes the opposite script before toggling the target. The capability probe uses the exported CommandManager with an explicit, disposable `editor.state.tr`, no focus, and no dispatch to the editor view (createChain's start-transaction contract in 3.32.0). The actual action rechecks availability and executes one focused chain. This is intentionally scoped to the two toolbar controls; extension keyboard shortcuts and external command consumers are not changed in this fix. Test both directions, toggling off, partial selections, collapsed stored mark switching and preservation of bold, with the same 22 mandatory group names. Four new static/orchestration tests use command doubles; real browser execution remains required. No dependencies, schema, sanitizer, public exports, or workflow changes.
