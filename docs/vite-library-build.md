# Vite production library contract (11.2F.2D)

The active entry remains `resources/js/index.ts`. ESM-only `dist/index.js`, `dist/editor.css` and a separate JS source map retain the existing Vite 7 browser target and minification defaults. React, React DOM and declared Tiptap peers (including their subpaths) remain host dependencies. Undeclared external imports and additional rendered third-party modules are rejected by the Vite build hook; the only permitted bundled npm module is the DOMPurify ESM implementation. The hook checks the installed version and emits the upstream Apache and MPL license texts. Legal comments are requested inline. This is attribution evidence, not a complete licensing opinion. The final release archive and redistribution notices are reviewed in F2F/G.

`npm run build` runs the accepted runtime, source declaration and consumer gates, then `npm run check:bundle`. The latter checks JS syntax, the exact four named/default runtime exports, static imports, a compiled `.version` assignment matching pinned DOMPurify 3.5.0, CSS export metadata and key selectors, absence of extra non-declaration output files, and source-map v3 structure. It verifies the map's local editor source contents (CRLF/LF equivalent), source paths, VLQ segments and mapping bounds, and requires both editor and DOMPurify mappings. When the vendor map names the direct ESM file it compares its embedded content with the installed file, ignoring the final source-map comment and trailing whitespace. Chained upstream source maps are allowed under the DOMPurify package path. Separate F2C declaration checks enforce the complete declaration inventory. License copies must match installed bytes. These are static/build gates, not proof of runtime browser behavior, semantic map accuracy, sanitization safety, or bit-identical builds across operating systems.

## Regression ceilings

| Output | Raw maximum | gzip maximum (level 9) |
|---|---:|---:|
| index.js | 280 KiB | 65 KiB |
| editor.css | 48 KiB | 12 KiB |
| index.js.map | 1024 KiB | recorded, not limited |

The original inspected build was 186,354 JS bytes, 34,343 CSS bytes, 559,617 map bytes. Its sanitizer was 3.4.17, so it is not an acceptable release build. Ceilings intentionally leave room for the updated sanitizer; review increases explicitly instead of adjusting limits to silence failures. Gzip metrics are local compression estimates, not actual HTTP transfer measurements.

## QA

Run `npm run test:runtime`, `npm run test:types`, `npm run test:bundle`, `npm run typecheck`, `npm run build`, `npm run check:bundle`, `npm audit`, `npm audit --omit=dev`. Build deletes and regenerates dist; preserve old dist outside the project if needed. The build emits 34 declarations (F2C), 3 JS/CSS/map files and 2 license text assets. New tests exercise validators and the Vite hook with synthetic fixtures/test doubles. Actual Vite execution remains a separate required gate. CI additionally writes `bundle-tests.log` and `bundle-summary.json` for each of the six existing Node lanes. Keep the accepted lockfile, PHP workflow, runtime and declaration tools unchanged. Do not commit generated dist or publish an npm package during this phase. Consumer runtime/browser testing, archive parity and final evidence review remain pending in F2E/F2F/F2G and later F phases.
