# 11.2D.8 - Media security integration and regression QA

This is a QA-only addition to the standalone MicroWeb Laravel Tiptap Editor.
It does not change production code, publish a package, or upgrade a host application.

## Baseline

11.2D.1 through 11.2D.7 were accepted by the user on Laravel 12 and Laravel 13.
The installer checks the reconstructed production and test baseline from the
accepted payloads (line-ending normalization only). It also checks the corrected
11.2B PHPUnit environment flags. A mismatch requires review; never force overwrite.

## New acceptance coverage

`EditorSecurityJourneyTest` adds eight tests using Testbench, genuine PNG bytes,
HTTP requests to the package upload endpoint, fake local storage, real sanitizer
and finalizer services, and the registered cleanup command:

1. Two distinct real uploads, mixed rich content, duplicate managed reference,
   Unicode captions, targeted rewriting, exact preserved bytes and repeat save.
2. Mixed ownership from two authenticated users, no partial move, permitted retry.
3. Sanitized mismatched path/URL batch rejection and corrected retry.
4. Cleanup command deletes abandoned temporary media but preserves finalized,
   fresh and unknown nested files and their bytes.
5. Cleanup of an expired referenced file blocks the entire later save batch.
6. Two independent Laravel file-cache stores sharing a disposable directory:
   busy upload (503), finalization rejection, deferred cleanup, successful retry.
7. A rejected malformed upload and a Gate denial do not disturb a valid earlier
   upload. The finalization API itself still relies on the host's save permission.
8. Real upload destination collision preserves both original byte sequences;
   retry uses a new UUID without overwriting the old destination.

The file-cache test is a same-process contention test using independent store
instances and the real file-cache implementation. It is NOT a concurrent
multi-process, Redis/database, lease-expiry, or network-failure test. Prior D4
mocked failure/rollback cases remain part of the full regression suite.

## Local acceptance commands (normal CMD)

Run inside C:\xampp\htdocs\laravel-tiptap-editor only. Switch dependencies
explicitly to the stack being tested, not inside MWT E-commerce.

Laravel 13:

    composer update --with "laravel/framework:^13.0" --with "orchestra/testbench:^11.0" --with "phpunit/phpunit:^12.0" --no-interaction
    composer validate --strict
    composer dump-autoload --optimize --strict-psr
    vendor\bin\phpunit --filter=EditorSecurityJourneyTest --stop-on-failure --stop-on-error
    composer test:13
    composer audit
    composer check-platform-reqs

Laravel 12:

    composer update --with "laravel/framework:^12.0" --with "orchestra/testbench:^10.0" --with "phpunit/phpunit:^11.5.50" --no-interaction
    composer dump-autoload --optimize --strict-psr
    composer test:12
    composer audit
    composer check-platform-reqs

Expected counts: 8 new tests, 198 full tests if the accepted D7 baseline contains
190 tests. Report actual counts, assertion counts, failures/warnings, framework,
Testbench, PHPUnit, and PHP versions for both runs. Stop after a failure.
Never run the cleanup command against a host's real media for this QA step.

## Closure decision

Only mark 11.2D complete when both full suites, Composer validation, strict
autoload, platform checks and security audits succeed. This closes the planned
standalone implementation and its local regression gates, NOT production security
certification. No Git tag, npm publication, or host dependency change is authorized
by these tests. 11.2E is the automated Laravel/PHP matrix and CI work.

## Residual risks / subsequent gates

- Real-browser CSRF, HTML mutation/XSS and visual round-trip behavior; Laravel
  route/config cache round trips; PHP 8.2/8.3 fallback parser compatibility.
- Shared-cache multi-process tests, lease expiry/eviction and storage aliasing;
  symlink/junction and external writer behavior. Locks are cooperative.
- Rollback is best-effort; no durable recovery journal or automatic compensation
  for a later host database write failure. Finalization checks existence, not
  content identity under hostile concurrent writers.
- Public storage URLs are not access control. Owner scopes do not authorize
  tenant/document changes. Legacy flat temporary drafts cannot be claimed;
  expired active drafts may need re-upload; key/guard changes invalidate scopes.
- Image inspection is structural, not full decode, re-encode, metadata removal,
  animation resource budgeting or malware scanning. Storage must prevent script
  execution and provide correct content types.
- MWT and other host custom endpoints need inspector, owner scope, lock and
  authorization integration. Host save must sanitize, finalize, re-sanitize,
  handle failures, and authorize access before saving. Existing HTML is not
  automatically migrated. Review strict CSS/URL/iframe compatibility in 11.2F.
- Previous local tests are user-reported. This QA package is not yet executed
  in Laravel or Windows PowerShell at authoring time.
