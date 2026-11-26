# Phase 11.2E.6 - CI security and evidence gates

Standalone editor only. Baseline: accepted E.5, commit d413687. No package runtime, Composer manifest, npm, or PHPUnit test code changes. All nine lanes remain.

## Action maintenance

Update setup-php from 2.36.0 to 2.40.0, pinned to eb7c497e18156a6bbabfef1d3a82760b9eda3962. The action declares node24, as do the existing checkout v5.0.0 and upload-artifact v6.0.0 pins. The older setup-php is in the affected range of GHSA-pqwm-q9pv-ph8r (CVE-2026-46420), fixed in 2.37.1. Existing explicit PHP-version inputs and read-only permissions reduce exposure; this does not establish exploitation. Preserve explicit runtime selection, no persisted checkout credentials, no privileged pull_request_target, and no automatic publish. Review pins periodically. Composer remains dynamically selected as v2 and the PHP patch release is selected by setup-php.

- https://github.com/shivammathur/setup-php/releases/tag/2.40.0
- https://github.com/shivammathur/setup-php/blob/2.40.0/action.yml
- https://github.com/advisories/GHSA-pqwm-q9pv-ph8r
- https://getcomposer.org/doc/03-cli.md#audit

## Quality gates

Discovery runs 20 standard-library Python unittest methods (including negative subtests), plus manifest policy and existing matrix validation. Python 3 is available on GitHub Ubuntu runners; optional on Windows for local self-tests. Each lane uses a disposable Composer home, rejects common policy/platform override variables and manifest policy/platform/repository overrides, then resolves fresh dependencies with the established constraints and lowest policy. No advisory exceptions. Audit both installed dependencies and the job-local lockfile, including dev dependencies. Fail on nonzero command results via pipefail. Require clean audit JSON with explicit advisories and abandoned fields; reject ignored findings, unreachable sources, filters/cooldown findings, unexpected fields or malformed data. Unknown schemas need review, not a bypass. A clean audit only covers the information available from configured sources at execution time. This is not a complete vulnerability or supply-chain scanner.

Require matching installed/locked package name-version maps, dev dependencies present, correct framework/testbench/phpunit major, and full PHPUnit JUnit evidence. Minimum 203 unique test identities, nonzero aggregate assertions, consistent suite counters, CacheCompatibilityTest and EditorSecurityJourneyTest present, no failures/errors/skips. PHPUnit additionally fails on empty, skipped, incomplete, risky and warning outcomes. Deprecations/notices are not newly made fatal. The minimum test count is a regression floor, not proof that every intended test ran; update it when the accepted suite grows. A future intentional skip requires documented policy review. The helper rejects malformed/oversized evidence and DTDs; it is an internal CI check, not a cryptographic attestation.

Every successful lane produces quality-summary.json (actual runtime, stack versions, package count, tests, assertions, audit results), both audit JSON files, JUnit XML, lock/installed metadata and execution log. The existing always-run collector preserves available failure evidence; upload missing-file errors fail the lane. The stable Required compatibility gate now requires discovery, all seven latest lanes AND both lowest probes. Lower-bound means lowest compatible secure resolution, not necessarily the literal lowest version of every declared constraint. Never bypass security checks to make a probe green. GitHub Actions permissions and triggers unchanged. Artifacts contain diagnostic metadata, not release files; review before sharing. Temporary Composer home is outside artifacts.

## Local acceptance (Windows CMD)

    php tools/compatibility-matrix.php --check
    composer validate --strict
    py -3 -B tools/test-ci-evidence.py
    py -3 -B tools/ci-verify-evidence.py preflight composer.json

If Python launcher is unavailable, the two Python commands run automatically in hosted discovery; no local Python installation is required. Do not run the CI-only shell script locally: it removes the checkout lockfile. No PHP test changes; no dependency switching needed solely for this patch. Keep local composer.lock/package-lock.json out of this commit. Review and stage only the five phase files, commit, push and open the new workflow.

## Hosted acceptance

11/11 jobs green, nine artifacts, nine quality-summary.json files with at least 203 tests, zero failed/skipped tests via the enforced gates and both audits clean; review actual versions and assertions. Check whether Node20 warnings disappear. Other warnings may remain; inspect before closure. If any job fails, provide job log and artifact (no secrets) for triage, do not disable checks. No change to branch protection or production release in this phase. Real host integration, frontend testing, and production concurrency remain pending.
