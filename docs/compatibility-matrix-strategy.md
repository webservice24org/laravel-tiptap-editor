# 11.2E.1 - Automated compatibility matrix architecture

Status: architecture only. No CI workflow, dependencies, production PHP code,
lockfile, or existing PHPUnit tests are modified by this package.

## Contract and evidence

The accepted 11.2D.8 baseline has 198 expected tests per framework. Local PHP
8.5 Laravel 12 and 13 acceptance is user-reported; other PHP minors and CI are
not yet verified. Keep existing Composer constraints unchanged until evidence
requires revising them. The declared PHP ^8.2 is a library requirement, not a
promise that every framework is installable on every PHP minor.

| Framework | PHP minors | Testbench | PHPUnit | Required jobs |
| --- | --- | --- | --- | --- |
| ^12.0 | 8.2, 8.3, 8.4, 8.5 | ^10.0 | ^11.5.50 | 4 |
| ^13.0 | 8.3, 8.4, 8.5 | ^11.0 | ^12.0 | 3 |

Laravel 13 on PHP 8.2 is explicitly excluded. PHP 8.6+, Laravel 14+, and
other test runner majors are not tested by this matrix. PHP 8.2 and Laravel 12
are approaching the end of security support; review upstream support dates
before release and when adding/removing lanes. Do not silently narrow support.

The source of truth is tools/compatibility-matrix.json (schema version 1).
The PHP validator checks the exact expected lane set, types, uniqueness,
constraints, and existing guarded Composer test scripts before emitting a
GitHub-compatible include matrix. It has no vendor dependency. The expected
set in the validator is an intentional independent contract: changes to the
matrix and contract should be reviewed together.

## Local architecture acceptance (Windows CMD or shell)

    php tools/compatibility-matrix.php --check
    php tools/compatibility-matrix.php --github
    php tools/compatibility-matrix.php --github-lowest
    composer validate --strict

Expected: seven latest-compatible jobs, two lower-bound probes, valid Composer
manifest. The --github commands emit one JSON line each, without running tests.
No composer update is needed for E.1. The runtime check is optional locally;
choose the actual PHP minor and the desired framework lane, e.g. on PHP 8.5:

    php tools/compatibility-matrix.php --runtime laravel-13-php-85-latest

This checks actual PHP minor and required extensions, not installed framework.
The existing composer test:12/test:13 scripts separately verify installed
framework, Testbench and PHPUnit major before executing the suite.

## E.2 workflow design (not installed in E.1)

Use fresh isolated Linux checkouts per lane; pin a reviewed runner image and
reviewed immutable action revisions; minimal contents:read token permissions;
no secrets for pull-request jobs. Set fail-fast false. Install actual PHP
minor and extensions (dom, fileinfo, libxml, mbstring, xml, xmlwriter plus
Composer/Laravel/PHPUnit requirements); use Composer 2. Do not fake PHP using
config.platform.php, ignore platform requirements or disable advisory blocking.
Keep caches limited to Composer downloads, keyed safely; never share vendor,
lockfiles, writable storage or test cache across lanes.

A discovery job validates the source matrix and exports the one-line JSON
for separate latest and lowest job groups. No need for a full Cartesian matrix.
Use matrix fields as quoted arguments, never evaluate them as shell code.
For each job, verify the selected runtime first, then run in order:

1. composer validate --strict
2. composer update --with "laravel/framework:<framework>" --with "orchestra/testbench:<testbench>" --with "phpunit/phpunit:<phpunit>" --prefer-stable --no-interaction --prefer-dist
3. composer check-platform-reqs
4. composer audit
5. composer dump-autoload --optimize --strict-psr
6. composer test:<laravel>
7. Record actual dependency/PHP versions, counts, warnings, failures and lockfile
   as diagnostic evidence, not release artifacts. Verify composer.json unchanged.

For lower-bound jobs add --prefer-lowest to step 2. Use a fresh resolution,
not the developer's lock. An audit failure, unsatisfiable version constraint,
platform failure or regression is a failure: do not suppress or bypass it.
Temporary Composer constraints are subsets of the existing root requirements
and do not rewrite composer.json. Do not publish generated job lockfiles.

## Dependency policy

Seven latest-compatible jobs are required checks, covering every supported
PHP/framework pair. The two lowest probes use minimum PHP for each framework
(12/8.2, 13/8.3) and prefer lowest stable compatible dependencies. Composer's
resolver may select higher versions due to transitive or security constraints;
these probes do not prove exact framework 12.0/13.0 support. Treat probes as
separate diagnostics initially, not substitutes for required green checks.
Before release, triage every lower-bound failure; fix code or raise documented
minimum constraints based on evidence, rerun and approve any support change.
Do not mark failing probes as passed. E.6 will finalize dependency gates.

## Subsequent acceptance

E.2: workflow installed, discovered matrix has correct lane counts, no secret
or write privileges for tests, no production deployment steps. E.3/E.4: record
actual results on all four Laravel 12 and three Laravel 13 required lanes.
E.5: separate route/config cache round-trip tests on both frameworks, using a
disposable application, never a real host cache. E.6: dependency and security
quality gates, warning policy, lower-bound triage; E.7: recorded CI evidence
and closure. Add Windows smoke testing if needed; Linux CI alone does not
establish Windows installer or junction behavior. Existing PHP 8.5 local
results do not establish PHP 8.2/8.3 legacy parser compatibility.

Preserve all security integration tests; do not skip failures by framework or
PHP minor without evidence and review. Browser tests (11.2F), release (11.2G),
host custom upload/save integration (11.2H) and residual storage risks remain
outstanding. MWT E-commerce stays on Laravel 12 until the editor release and
integration are complete.

## References (verified 2026-11-26)

- https://laravel.com/docs/13.x/releases
- https://laravel.com/docs/12.x/releases
- https://github.com/orchestral/testbench-core#version-compatibility
- https://phpunit.de/supported-versions.html
- https://getcomposer.org/doc/03-cli.md
- https://getcomposer.org/doc/02-libraries.md
