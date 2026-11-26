# 11.2D.1 — Media path safety foundation

Install in the standalone editor package, not a host application. No migration, Composer constraint or npm change is required.

## Contract

All package-managed storage paths must be canonical disk-relative paths. Each slash-separated segment must start with an ASCII letter, digit, underscore or hyphen; subsequent characters may also include dots. Empty segments, dot segments, leading/trailing slashes, trailing dots, whitespace, Unicode, Windows device names, backslashes, colons, percent encoding, query/fragment punctuation, and control characters are rejected. Maximum segment length is 255 bytes; maximum total length is 1024 bytes. Existing UUID and ordinary ASCII product filenames are supported. Do not normalize or decode arbitrary storage paths. HTML extraction decodes HTML entities once, then validates the result. Invalid references are skipped; existing HTML is not sanitized by this operation.

Invalid configured directory values and overlapping roots fail closed with InvalidArgumentException before storage access. Both configured roots must be valid and disjoint, including case aliases and ancestor/descendant relationships. The optional finalize destination is a trusted server-side argument, not user input. Disjoint custom destinations such as news/42 and editor/images/products/42/description remain supported. Explicit empty destinations are now invalid; omit the parameter to use the configured default. A legacy published config with leading/trailing slash, whitespace or other noncanonical characters must be corrected before adopting this package. No automatic file migration is performed.

Membership requires a strict, case-sensitive child of the temporary directory. Cleanup validates every returned candidate before stat or delete. The built-in upload controller validates configuration, generated destination and returned path. Existing host-specific upload controllers are unchanged and must validate their own paths; review during integration.

## Boundaries

This is lexical validation, not filesystem sandboxing or authorization. A trusted disk root must be correctly configured and not contain attacker-controlled symlinks or Windows junctions. Custom destinations must be selected by authorized host code. The existing HTML extraction and rewrite algorithm remains in place; it is not proof of ownership or a complete parser. Entity-encoded or differently formatted valid attributes may need rewrite hardening in D.3. D.2–D.7 will address ownership, safe finalization/rewrite, storage failure handling, cleanup races, sanitizer and image validation. Do not deploy this intermediate package as a final security release.

## Local QA (CMD, standalone package)

composer validate --strict
composer test:13
composer audit
composer check-platform-reqs
composer dump-autoload --optimize --strict-psr

Then switch the testing stack:

composer update --with "laravel/framework:^12.0" --with "orchestra/testbench:^10.0" --with "phpunit/phpunit:^11.5.50" --no-interaction
composer test:12
composer audit
composer check-platform-reqs
composer dump-autoload --optimize --strict-psr

Both stacks must pass the full suite. No release or MWT dependency update yet.
