#!/usr/bin/env python3
"""CI evidence gate; standard library only, no package runtime changes."""
import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

MIN_TESTS = 203
MAX_BYTES = 32 * 1024 * 1024
AUDIT_KEYS = {'advisories', 'abandoned', 'ignored-advisories', 'unreachable-repositories', 'filter', 'cooldown'}
STACK = {'12': {'laravel/framework': '12', 'orchestra/testbench': '10', 'phpunit/phpunit': '11'},
         '13': {'laravel/framework': '13', 'orchestra/testbench': '11', 'phpunit/phpunit': '12'}}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read(path):
    require(path.is_file() and path.stat().st_size <= MAX_BYTES, f'Missing or oversized evidence: {path.name}')
    return path.read_bytes()


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, f'Duplicate JSON key: {key}')
        result[key] = value
    return result


def load(path):
    return json.loads(read(path), object_pairs_hook=unique_object)


def check_manifest(path):
    manifest = load(path)
    require(isinstance(manifest, dict) and manifest.get('name') == 'microweb/laravel-tiptap-editor', 'Wrong package manifest')
    # No repository overrides or policy overrides in this standalone library CI.
    require('repositories' not in manifest, 'Custom repositories require explicit CI policy review')
    config = manifest.get('config', {})
    require(isinstance(config, dict), 'Invalid Composer config')
    require(not set(config) & {'audit', 'policy', 'platform', 'disable-tls', 'secure-http'}, 'Composer policy/platform override requires review')


def audit(path):
    report = load(path)
    require(isinstance(report, dict) and {'advisories', 'abandoned'} <= report.keys(), f'Incomplete audit: {path.name}')
    require(set(report) <= AUDIT_KEYS, f'Unknown audit fields: {path.name}; review schema')
    for key, value in report.items():
        require(isinstance(value, (list, dict)) and not value, f'Non-clean audit field {key}: {path.name}')


def package_map(entries):
    require(isinstance(entries, list) and entries, 'Missing package list')
    result = {}
    for entry in entries:
        require(isinstance(entry, dict), 'Invalid package entry')
        name, version = entry.get('name'), entry.get('version')
        require(isinstance(name, str) and name and isinstance(version, str) and version, 'Missing package name/version')
        require(name not in result, f'Duplicate package: {name}')
        result[name] = version
    return result


def dependencies(report, major):
    lock = load(report / 'composer.lock')
    installed = load(report / 'installed.json')
    require(isinstance(lock, dict) and isinstance(lock.get('packages'), list) and isinstance(lock.get('packages-dev'), list), 'Invalid lockfile')
    require(isinstance(installed, dict) and installed.get('dev') is True, 'Development dependencies not recorded')
    locked = package_map(lock['packages'] + lock['packages-dev'])
    actual = package_map(installed.get('packages'))
    require(locked == actual, 'Locked and installed package versions differ')
    for package, version_major in STACK[major].items():
        require(re.match(r'^v?' + version_major + r'\.', actual.get(package, '')) is not None, f'Wrong installed version: {package}')
    return {name: actual[name] for name in STACK[major]}, len(actual)


def integer(value, field):
    require(isinstance(value, str) and re.fullmatch(r'[0-9]+', value) is not None, f'Invalid JUnit {field}')
    return int(value)


def junit(path):
    data = read(path)
    # PHPUnit emits UTF-8 XML without DTDs. Reject alternate encodings and entities.
    decoded = data.decode('utf-8-sig')
    require('\x00' not in decoded and not re.search(r'<!\s*(?:DOCTYPE|ENTITY)', decoded, re.I), 'Unexpected JUnit DTD/entity/encoding')
    root = ET.fromstring(decoded)
    require(root.tag in {'testsuites', 'testsuite'}, 'Invalid JUnit root')
    cases = list(root.iter('testcase'))
    require(len(cases) >= MIN_TESTS, f'Expected at least {MIN_TESTS} tests; got {len(cases)}')
    identities = set()
    assertions = 0
    for case in cases:
        identity = (case.get('class') or case.get('classname'), case.get('name'))
        require(all(identity) and identity not in identities, 'Missing or duplicate test identity')
        identities.add(identity)
        require(not any(node.tag in {'failure', 'error', 'skipped', 'warning'} for node in case.iter()), 'Unsuccessful or skipped JUnit case')
        count = integer(case.get('assertions'), 'assertions')
        # Some valid tests expect exceptions; require nonzero aggregate, not each case.
        assertions += count
    require(assertions > 0, 'No assertions recorded')
    for suite in root.iter():
        if suite.tag not in {'testsuites', 'testsuite'}:
            continue
        if suite.tag == 'testsuite':
            require(suite.get('tests') is not None, 'Missing suite test count')
        if 'tests' in suite.attrib:
            require(integer(suite.get('tests'), 'tests') == len(list(suite.iter('testcase'))), 'JUnit suite count mismatch')
        for field in ('failures', 'errors', 'skipped', 'warnings', 'incomplete', 'risky'):
            if field in suite.attrib:
                require(integer(suite.get(field), field) == 0, f'JUnit reports {field}')
        if 'assertions' in suite.attrib:
            require(integer(suite.get('assertions'), 'assertions') == sum(integer(c.get('assertions'), 'assertions') for c in suite.iter('testcase')), 'JUnit assertion count mismatch')
    require(any(name.split('\\')[-1] == 'CacheCompatibilityTest' for name, _ in identities), 'Cache regression suite absent')
    require(any(name.split('\\')[-1] == 'EditorSecurityJourneyTest' for name, _ in identities), 'Security journey suite absent')
    return len(cases), assertions


def verify(report, lane, php, major):
    require(major in STACK and re.fullmatch(r'laravel-(12|13)-php-8[2345]-(latest|lowest)', lane), 'Invalid lane')
    require(re.fullmatch(r'8\.[2345]\.\d+(?:[a-zA-Z0-9.+-]*)?', php) is not None, 'Invalid PHP runtime')
    require(lane.startswith(f'laravel-{major}-php-{php.split(".")[0]}{php.split(".")[1]}-'), 'Lane/runtime mismatch')
    require(read(report / 'resolution-started').decode().strip() == lane, 'Wrong resolution marker')
    audit(report / 'composer-audit.json')
    audit(report / 'composer-audit-locked.json')
    versions, packages = dependencies(report, major)
    tests, assertions = junit(report / 'phpunit.xml')
    return {'schema_version': 1, 'status': 'passed', 'lane': lane, 'php': php, 'stack': versions,
            'packages': packages, 'tests': tests, 'assertions': assertions, 'minimum_tests': MIN_TESTS,
            'installed_audit': 'clean', 'locked_audit': 'clean'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='mode', required=True)
    pre = sub.add_parser('preflight')
    pre.add_argument('manifest', type=Path)
    run = sub.add_parser('verify')
    run.add_argument('report', type=Path)
    run.add_argument('lane')
    run.add_argument('php')
    run.add_argument('major', choices=STACK)
    args = parser.parse_args()
    try:
        if args.mode == 'preflight':
            check_manifest(args.manifest)
            print('Composer manifest policy verified.')
        else:
            output = args.report / 'quality-summary.json'
            output.unlink(missing_ok=True)
            summary = verify(args.report, args.lane, args.php, args.major)
            output.write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8')
            print(f"Evidence verified: {summary['lane']}, {summary['tests']} tests, {summary['assertions']} assertions.")
    except (ValueError, TypeError, KeyError, OSError, ET.ParseError) as error:
        print(f'CI evidence rejected: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
