# Phase 11.2B - Laravel compatibility test foundation

This is a development candidate, not a released v1.1.0. The package's PHP runtime
requires laravel/framework because MediaUploadRequest extends Foundation FormRequest.
The full framework supplies the five previous Illuminate dependencies. PHP remains
^8.2; Laravel 13 itself requires PHP >=8.3. DOM, libxml and fileinfo are explicit.
Testbench and PHPUnit are development-only. Existing upload route, PHP services,
React source, npm version, dist and tarball are unchanged. The upload endpoint's
existing authorization limitations remain open until 11.2C/D; do not deploy the
candidate or enable the built-in endpoint in an untrusted environment.

## Local test procedure (standalone package only)

Use a clean package checkout or disposable copy, not MWT E-commerce and not its
vendor directory. Back up composer.json and any existing composer.lock before
changing dependencies. Do not share an .env or private Composer credentials.

From the standalone package root, with PHP 8.5 and Composer 2.11.3:

```cmd
composer validate --strict
composer update --with "laravel/framework:^12.0" --with "orchestra/testbench:^10.0" --with "phpunit/phpunit:^11.5.50" --no-interaction
composer check-platform-reqs
composer audit
composer test:12
composer dump-autoload --optimize --strict-psr
```

Then, after the Laravel 12 suite passes:

```cmd
composer update --with "laravel/framework:^13.0" --with "orchestra/testbench:^11.0" --with "phpunit/phpunit:^12.0" --no-interaction
composer check-platform-reqs
composer audit
composer test:13
composer dump-autoload --optimize --strict-psr
```

These are full dependency resolutions with temporary constraints; they do not
change composer.json, but they update the standalone lockfile and vendor directory.
The test scripts fail before PHPUnit if the installed framework/Testbench/PHPUnit
major versions do not match. Do not ignore platform requirements or audit failures.
If a resolution fails, capture the output and stop. Run both suites separately;
a generic composer test alone does not prove dual compatibility. Do not publish
or integrate into a host application until later security and release gates pass.
If PHP 8.2 is used, only run the Laravel 12 path. Full PHP version CI is 11.2E.

Tests isolate configuration with array cache/session, in-memory SQLite (no DB
queries), disabled built-in upload/scheduler, and fake storage where used. Nine
test methods cover service/container wiring, config and publish tag, route
registration, disabled upload, cleanup invocation and baseline sanitizer behavior.
These are smoke tests, not a complete security assessment. No credentials, real
host database or public upload directory are needed.

Report both Composer resolution results, both `composer test:12` / `composer test:13`
outputs, and audit/platform results. Keep the Laravel 13 app upgrade pending.
