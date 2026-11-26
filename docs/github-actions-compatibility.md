# 11.2E.2 - GitHub Actions CI workflow

Install only in the standalone `microweb/laravel-tiptap-editor` repository.
No production PHP, PHPUnit test files, Composer constraints or package releases
are changed. This phase installs workflow wiring; actual hosted execution is
required to verify PHP 8.2-8.5 compatibility.

## Workflow

`.github/workflows/editor-compatibility.yml` uses the E.1 matrix generator to
emit 7 required latest lanes and 2 independent lower-bound probes. Ubuntu
24.04 GitHub-hosted runners, PHP setup, Composer 2, no coverage driver, no shared
vendor/download cache, 25-minute lane timeout and fail-fast disabled. Triggers:
push to main/master, pull requests, manual dispatch, Monday 03:17 UTC schedule
(default branch only for schedule/manual workflow availability). No deployment,
secrets, write permissions, pull_request_target or publishing. Checkout does
not persist credentials. Third-party actions are pinned to full commit SHAs
from the official upstream release pages (not a claim of newest versions):

- https://github.com/actions/checkout/releases/tag/v5.0.0
- https://github.com/shivammathur/setup-php/releases/tag/2.36.0 (PHP 8.5 stable support)
- https://github.com/actions/upload-artifact/releases/tag/v6.0.0
- https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/run-job-variations
- https://docs.github.com/en/actions/reference/security/secure-use

Review and update action pins as upstream changes; setup-php still obtains
runtime packages dynamically. No private Composer packages or secrets are
expected. Repository policy must permit these actions. This targets GitHub.com,
not GitHub Enterprise Server.

## Quality gates

`tools/ci-compatibility-lane.sh` is CI-only. It validates actual PHP runtime and
lane environment against the accepted matrix, checks Composer metadata, removes
only the disposable checkout's lockfile, then resolves dependencies with the
lane's exact constraints. No platform emulation, security bypass or
continue-on-error. Lower probes additionally use --prefer-lowest --prefer-stable.
The installed stack guard and PHPUnit are invoked directly (equivalent to the
existing guarded Composer scripts, with a JUnit log destination). Bash pipefail
propagates failures through tee. Each lane records actual versions in the log,
audit JSON if reached, JUnit if reached, and newly resolved lock/installed
metadata where available. Artifacts are diagnostic only, expire after 14 days,
and may be incomplete on early failures/cancellation. Never publish them as
release artifacts. Repository viewers may see artifacts; no credentials or
host application data should be used. Manifest drift fails the job.

Required compatibility gate is an always-evaluated aggregate for discovery
and all seven latest jobs; select this stable check in branch protection only
after first run. Lowest probes are independent, not dependencies of that gate;
a failing probe still makes the overall workflow red. Investigate all failures
before release. No automatic branch protection modification is performed.

## Install and verify

After guarded preview and installation, run in CMD:

    php tools/compatibility-matrix.php --check
    composer validate --strict
    git status --short
    git diff --check
    git remote -v
    git branch --show-current

Review changes and ensure all prior phases and corrected phpunit.xml are tracked
before pushing. Do not push .env, vendor, node_modules, credentials, backup
folders or generated local dependency lock unless intentionally tracked. Do not
run the CI-only bash script on the developer workstation. Use a feature branch
if desired, open a PR against the default branch; alternatively push reviewed
commits to main/master if that is your established repository workflow.

Stage the three new files and any reviewed pending earlier phase files, inspect
`git diff --cached --stat` and `git diff --cached --check`, commit and push the
current branch. If using a feature branch, open a PR to trigger CI. The workflow
will appear under Actions > Editor compatibility. Manual Run workflow is
available after the workflow is on the default branch. If repository Actions
are disabled, enable them in repository settings or ask an administrator.

Report discovery, required gate, each of the seven latest jobs and two lowest
probes, including PHP/Laravel actual versions and test counts. Download evidence
from the run's Artifacts section for failed lanes. Do not disable security audit
or skip tests to make the status green. No claim of hosted CI execution is made
by this package. E.3 and E.4 will inspect actual Laravel 12/13 lane outcomes;
E.5 cache round-trips, E.6 security/dependency gate acceptance, E.7 closure.
