# 11.2F.4 — Image Upload & Media Lifecycle Integration

## Scope

Candidate based on the user-accepted F3I state. No dependency, package version, public entrypoint, Composer production code, workflow, MWT host, storage schema or publishing change. The existing F3I guarded inventory is preserved except the reviewed image-dialog handler; the image-only sanitizer change does not alter link, table, video or News Block policies. The built-in fetch requires a same-origin endpoint and refuses redirects; explicitly configure the actual endpoint, or use the host callback for intentionally cross-origin uploads. HTTP and host callback results use the same runtime URL/path/temporary shape validation. HTTP(S) and root-relative image URLs are allowed; bare hosts, fragments, scheme-relative and credential-bearing URLs and data/blob URLs are rejected for persisted image sources. Blob URLs remain local previews only. This narrows existing browser behavior to the server's image URL boundary; server validation, ownership, authorization and finalization remain authoritative. Do not interpret the optional path as a trusted ownership claim. No client request deletes permanent media.

## Regression gates

Packed React 18 and React 19 consumers retain the 85 F3 groups and add 10 media groups (95 each): real loopback synthetic multipart upload/CSRF, persisted managed metadata/remount, pointer resize/left wrapping/replacement metadata, document-only deletion, alternate endpoint, direct URL/cancel, expected 422 rejection, malformed result/cross-origin rejection, custom callback, unsafe direct URL. Only the single explicitly asserted 422 fixture response and corresponding exact resource console error are permitted; other errors and off-origin requests still fail. Synthetic HTTP server records actual multipart bytes; it is not a Laravel server and never receives host data. The original closure verifier now requires 95 groups from each fresh report; use the original F3I verifier for archived 85-group evidence. New PHP journey regression uses the existing Testbench fixtures and real upload/finalization services to verify abandoned temporary media cleanup and preservation of removed/replaced permanent files. Existing D1-D8 tests remain mandatory. The fake filesystem is not production storage or proof of distributed locking.

## Local acceptance (Windows CMD, standalone editor only)

    cd /d C:\xampp\htdocs\laravel-tiptap-editor
    git status --short
    npm.cmd run test:runtime
    npm.cmd run test:types
    npm.cmd run test:bundle
    npm.cmd run test:archive
    npm.cmd run test:toolbar
    npm.cmd run check:toolbar
    npm.cmd run test:consumer:contract
    npm.cmd run typecheck
    npm.cmd run build
    npm.cmd run test:consumer -- 18
    npm.cmd run test:consumer -- 19
    npm.cmd audit --audit-level=low
    npm.cmd audit --omit=dev --audit-level=low

Expected consumer contract: 46 tests (formerly 44); browser evidence: 95 groups per React major (formerly 85); archive distribution inventory remains 39 files, 42 package entries. Retain previous validator gates; investigate any declaration or bundle drift. Use a Node version accepted by the existing runtime checker. On both Laravel stacks, run the focused test and then full suites, using standalone Composer only:

    composer update --with "laravel/framework:^13.0" --with "orchestra/testbench:^11.0" --with "phpunit/phpunit:^12.0" --no-interaction
    composer validate --strict
    composer dump-autoload --optimize --strict-psr
    vendor\bin\phpunit --filter=EditorSecurityJourneyTest --stop-on-failure --stop-on-error
    composer test:13
    composer audit
    composer check-platform-reqs

    composer update --with "laravel/framework:^12.0" --with "orchestra/testbench:^10.0" --with "phpunit/phpunit:^11.5.50" --no-interaction
    composer dump-autoload --optimize --strict-psr
    vendor\bin\phpunit --filter=EditorSecurityJourneyTest --stop-on-failure --stop-on-error
    composer test:12
    composer audit
    composer check-platform-reqs

Expected focused test count: 9 (previously 8). Record actual complete suite counts. Use both appropriate PHP versions/dependencies, not MWT's lockfile. Do not run cleanup on real storage. Stop on failure.

## Browser integration acceptance in a disposable authorized Laravel consumer

Use the existing standalone editor demo or a disposable host, never production/MWT. Verify valid JPEG/PNG/WebP/GIF within the configured limits; blocked SVG/spoofed/non-image, oversized images and invalid dimensions; missing/expired CSRF (real middleware), unauthenticated and unauthorized upload, disabled uploads, same-origin custom URL, request failure then retry, and replacement failure preserving the previous image. Verify file selection/drop, cancel, insert URL, caption/alt, resize/wrap, replace/remove, remount and Bengali content. Save using host authorization, sanitize -> finalize -> re-sanitize -> persist. Confirm owner-scoped temporary references change to permanent paths and URLs on save; verify foreign-owner and mismatched URL/path rejection, repeat save, expiry, cleanup, and retained permanent media after removal. Use fake/test storage and synthetic assets. Confirm that a finalized host value reopens with the permanent URL/path. This manual real-Laravel browser check is separate from mocked/synthetic consumer automation; do not claim it from the browser report alone.

## Hosted acceptance

Commit only reviewed payload changes, push, and verify the existing PHP (7 latest + 2 lowest lanes), Node (6 lanes), and React (2 lanes) workflows for one exact commit. Run `node tools/formatting-closure.cjs <full-commit-sha> <React18-extracted-dir> <React19-extracted-dir>` on fresh successful evidence: expected `react-evidence-consistent` and 190 total groups. The verifier is offline consistency review, not provenance authentication. No npm/Composer publish, no tag, no changes to MWT E-commerce. Mark F4 passed only after both local stacks, React lanes, all validators, hosted evidence and real-browser integration check are green. F5 follows (tables, video and News Blocks). No optional media library, cropping, transformations, cloud storage expansion or new editor features.

## Authoring limitations

Historical source and accepted incremental packs were recovered; the local post-F3I checkout was not directly accessible. Hash preflight must pass. Node contracts and static syntax were checked in the authoring environment, but real Laravel, Chromium, installed dependency typecheck/build and hosted CI are pending. Do not bypass checksum failures or relax tests to achieve green.
