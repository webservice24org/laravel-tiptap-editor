#!/usr/bin/env bash
# CI only: this script intentionally removes a job-local Composer lockfile.
set -euo pipefail
if [[ "${GITHUB_ACTIONS:-}" != true || -z "${RUNNER_TEMP:-}" ]]; then
    echo 'Run this script only inside an isolated GitHub Actions job.' >&2
    exit 1
fi
report="$RUNNER_TEMP/editor-compatibility"
mkdir -p "$report"
# Isolate Composer policy from any machine-level config/plugins. Never upload this home.
for key in COMPOSER COMPOSER_NO_AUDIT COMPOSER_NO_SECURITY_BLOCKING COMPOSER_NO_BLOCKING COMPOSER_IGNORE_PLATFORM_REQS COMPOSER_IGNORE_PLATFORM_REQ COMPOSER_POLICY COMPOSER_AUDIT_ABANDONED COMPOSER_REPO_PACKAGIST COMPOSER_DISABLE_NETWORK COMPOSER_NO_DEV; do
    if [[ -n "${!key:-}" ]]; then
        echo "Unexpected Composer override: $key" >&2
        exit 1
    fi
done
export COMPOSER_HOME="$(mktemp -d "$RUNNER_TEMP/editor-composer-home.XXXXXX")"
python3 -B tools/ci-verify-evidence.py preflight composer.json
# Check environment against the actual validated matrix, not a caller's assumptions.
php tools/compatibility-matrix.php --runtime "$LANE_ID"
php -r '
    $data = json_decode(file_get_contents("tools/compatibility-matrix.json"), true, 32, JSON_THROW_ON_ERROR);
    $fields = ["id" => "LANE_ID", "laravel" => "LARAVEL_MAJOR", "framework" => "FRAMEWORK_CONSTRAINT", "testbench" => "TESTBENCH_CONSTRAINT", "phpunit" => "PHPUNIT_CONSTRAINT", "policy" => "DEPENDENCY_POLICY"];
    foreach ($data["lanes"] as $lane) {
        if ($lane["id"] !== getenv("LANE_ID")) continue;
        foreach ($fields as $field => $env) {
            if ($lane[$field] !== getenv($env)) { fwrite(STDERR, "Lane environment mismatch: $env\n"); exit(1); }
        }
        exit(0);
    }
    exit(1);
'
php -v
php -m
composer --version
composer validate --strict
# The checkout may contain a developer lock; all lanes resolve independently.
rm -f composer.lock
printf '%s\n' "$LANE_ID" > "$report/resolution-started"
flags=(--prefer-stable --no-interaction --prefer-dist)
if [[ "$DEPENDENCY_POLICY" == lowest ]]; then flags+=(--prefer-lowest); fi
composer update --with "laravel/framework:$FRAMEWORK_CONSTRAINT" \
    --with "orchestra/testbench:$TESTBENCH_CONSTRAINT" \
    --with "phpunit/phpunit:$PHPUNIT_CONSTRAINT" "${flags[@]}"
composer check-platform-reqs
composer audit --format=json | tee "$report/composer-audit.json"
composer audit --locked --format=json | tee "$report/composer-audit-locked.json"
composer dump-autoload --optimize --strict-psr
# Equivalent to guarded composer test:<major>, with an explicit JUnit destination.
php tools/assert-test-stack.php "$LARAVEL_MAJOR"
php vendor/bin/phpunit --fail-on-empty-test-suite --fail-on-skipped --fail-on-incomplete --fail-on-risky --fail-on-warning --log-junit "$report/phpunit.xml"
cp composer.lock "$report/composer.lock"
cp vendor/composer/installed.json "$report/installed.json"
git diff --exit-code HEAD -- composer.json
python3 -B tools/ci-verify-evidence.py verify "$report" "$LANE_ID" "$(php -r 'echo PHP_VERSION;')" "$LARAVEL_MAJOR"
