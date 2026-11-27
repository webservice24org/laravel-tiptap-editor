# 11.2F.3I — Full formatting regression and closure

Baseline: F3H acceptance reported by user. This phase adds only offline evidence consistency review and its automated contract tests. No production behavior, workflow, npm dependency, lockfile or public API changes. The 72-file guarded installation baseline is a scoped snapshot, not a hash of every repository file.

## Closure sequence

1. Preview and install the guarded F3I package. Verify 44 consumer contract tests and all 78 toolbar tests; retain the 55 controls, 23 options, 36 chains, 15 sources inventory. Run the other existing validators, TypeScript, clean build, both consumers and both npm audits. Do not publish.
2. Commit the three F3I files and push. Confirm all three GitHub Actions workflows succeeded on the exact same full commit SHA, including all seven latest and two lowest PHP lanes, six Node lanes, two React lanes and required gates. The new tests execute through the existing React workflow consumer contract command.
3. Download both successful React artifacts from that exact run and extract to separate directories. From the project root run:

    node tools/formatting-closure.cjs <full-commit-sha> <React18-extracted-dir> <React19-extracted-dir>

   Use the full commit from GitHub (or `git rev-parse HEAD` if the local HEAD matches the hosted commit). The extracted directories must contain the original JSON evidence files directly. The tool reads only, emits JSON to stdout, and returns a nonzero exit on mismatch. It requires hosted Linux Node 24 evidence, not local Windows evidence.
4. Expected status is `react-evidence-consistent`, 170 browser groups, 39 distribution hashes, both exact React versions. Retain the output and workflow links outside the repository. Investigate differences rather than rewriting reports. Archive bytes are not included in React artifacts: the verifier cross-checks recorded SHA-256, SRI, lock checksum, exact distribution inventory, expected version records, browser reports, run ledger and audits; it does not independently hash archive or dist bytes, authenticate GitHub provenance, re-execute tests, or confirm the other workflows. Both consumers must report matching archive and dist hashes; investigate any environment/build differences. Manifest and lock hashes are compared to LF-normalized project files because the hosted workflow runs on Linux. If Git stores different bytes, inspect the discrepancy instead of bypassing the check.
5. Mark F3I and F3 complete only after the actual local gates, hosted workflows and offline evidence review succeed. Current acceptance is pending.

## Accepted formatting scope and deferred work

F3A–H: toolbar inventory; six inline marks; paragraph/headings/blockquote/rule/code preservation; list nesting/alignment/start; link and preset typography; native history and keyboard isolation; contextual toolbar and multi-editor isolation; exact 85-group Chromium evidence per React major. F3I does not increase functional browser groups. Known nonblocking warnings remain recorded. This does not claim Firefox/WebKit/macOS coverage, full table or media lifecycle, all source-mode security or accessibility, or release readiness. Next F4 image upload and media lifecycle; F5 tables/video/news; F6 source mode; F7 responsive/accessibility; F8 CI consolidation; F9 final frontend regression; G versioned release; H MWT integration; then 11.3 MWT Laravel 13 upgrade. The editor remains unpublished and MWT remains unchanged.
