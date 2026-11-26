# 11.2D.2 — Temporary media ownership foundation

Install only in the standalone package. This is an intermediate, unreleased security candidate.

## Contract and migration

New uploads are stored in `editor/tmp/owner-<64 lowercase hex characters>/<generated filename>`, using a server-derived HMAC of the configured guard, authenticated user class and identifier with the application key. No ownership value is accepted from the request or editor HTML. The same authenticated identity and app key resolve the same scope. The HMAC path is not a bearer token. Finalization preflights all recognized canonical temporary references, including case aliases of the temporary root, before disk lookup; foreign, unowned legacy, guest or nested references throw AuthorizationException. Host code must not swallow this exception and persist the original HTML. Permanent media and content without temporary references do not require authentication. The existing url/path/temporary JSON response and two original finalize parameters remain; an optional third `guard` parameter allows a trusted host to explicitly choose its authentication guard. No owner database or migration is required.

Existing flat temporary uploads cannot be securely attributed and are not automatically adopted. Save or discard outstanding drafts on the old version before upgrade; re-upload any unresolved temporary images after upgrade. Never bulk assign old files to a user. Permanent images are not renamed. App key rotation, changing guard/model identity, or changing temp directory can invalidate outstanding uploads; plan a drain/reupload before changes. Use separate app keys/storage roots or distinct authenticated realms for separate tenants; this package does not implement tenant or document authorization. Users sharing one authenticated account share its temporary scope. Background jobs must finalize in an explicitly authorized authenticated context; no anonymous bypass.

## Custom host upload integration (required before host upgrade)

Keep existing host route policy and validation. Replace the old flat temp directory calculation in your authorized custom upload controller with `TemporaryMediaOwner::directory('admin')` (or the actual server-selected guard), retain generated safe filenames and validate the returned path. The save service must call `finalize(html: $cleanHtml, directory: $trustedDestination, guard: 'admin')` with the same guard. Never take the guard or destination from untrusted request fields. Default built-in upload uses the configured upload_route.guard; existing host config may omit it and defaults to web. For MWT the actual guard must be verified at integration; do not blindly use the illustrative admin guard. Existing host custom upload URLs remain supported but the old flat path convention will be rejected. Host application changes are deferred to 11.2H.

## Scope and limitations

This prevents one authenticated actor from moving another actor's recognized temporary file via the package finalizer. Public-disk URL reads are NOT private; this does not prevent copying or embedding another publicly accessible image, and an omitted/obfuscated managed attribute is not proof of ownership. HTML parsing and rewrite hardening are next (D.3); this is not an HTML sanitizer or a complete content ownership mechanism. Filesystem symlinks/junctions, collision/partial moves, cleanup/finalize races, image validation and target authorization remain separate concerns. Cleanup still recursively expires valid temporary paths across all owners, including legacy files; no new cleanup semantics here. Do not publish or deploy this intermediate candidate.

## QA (normal CMD in standalone editor)

composer validate --strict
composer dump-autoload --optimize --strict-psr
vendor\bin\phpunit --filter="TemporaryMediaOwnershipTest|MediaPathBoundaryTest" --stop-on-failure --stop-on-error
composer test:13
composer audit
composer check-platform-reqs

Switch to Laravel 12 only after green:

composer update --with "laravel/framework:^12.0" --with "orchestra/testbench:^10.0" --with "phpunit/phpunit:^11.5.50" --no-interaction
composer test:12
composer audit
composer check-platform-reqs
composer dump-autoload --optimize --strict-psr

Expected: 83 total tests on each framework (70 existing, 13 new).
