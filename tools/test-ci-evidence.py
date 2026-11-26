#!/usr/bin/env python3
"""Synthetic positive/negative tests for CI evidence verification."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import xml.etree.ElementTree as ET

spec = importlib.util.spec_from_file_location('evidence', Path(__file__).with_name('ci-verify-evidence.py'))
e = importlib.util.module_from_spec(spec)
spec.loader.exec_module(e)


class EvidenceTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.lane = 'laravel-12-php-82-latest'
        (self.root / 'resolution-started').write_text(self.lane)
        for file in ('composer-audit.json', 'composer-audit-locked.json'):
            self.write(file, {'advisories': [], 'abandoned': [], 'filter': [], 'cooldown': []})
        self.packages = [{'name': 'laravel/framework', 'version': 'v12.74.0'}, {'name': 'orchestra/testbench', 'version': 'v10.12.0'}, {'name': 'phpunit/phpunit', 'version': '11.5.58'}]
        self.write('composer.lock', {'packages': self.packages[:1], 'packages-dev': self.packages[1:]})
        self.write('installed.json', {'dev': True, 'packages': self.packages})
        self.tree = ET.Element('testsuites')
        self.suite = ET.SubElement(self.tree, 'testsuite', tests='203', assertions='406', failures='0', errors='0', skipped='0')
        for i in range(203):
            cls = ['CacheCompatibilityTest', 'EditorSecurityJourneyTest', 'ExampleTest'][min(i, 2)]
            ET.SubElement(self.suite, 'testcase', {'class': 'Tests\\' + cls, 'name': f'test_{i}', 'assertions': '2'})
        self.save_xml()

    def write(self, file, data):
        (self.root / file).write_text(json.dumps(data), encoding='utf-8')

    def save_xml(self):
        ET.ElementTree(self.tree).write(self.root / 'phpunit.xml', encoding='utf-8', xml_declaration=True)

    def verify(self):
        return e.verify(self.root, self.lane, '8.2.30', '12')

    def reject(self):
        with self.assertRaises((ValueError, OSError, ET.ParseError)):
            self.verify()

    def test_clean(self):
        self.assertEqual(self.verify()['tests'], 203)

    def test_older_audit_schema(self):
        self.write('composer-audit.json', {'advisories': {}, 'abandoned': []})
        self.assertEqual(self.verify()['assertions'], 406)

    def test_missing_report(self):
        (self.root / 'phpunit.xml').unlink()
        self.reject()

    def test_incomplete_audit(self):
        self.write('composer-audit.json', {'abandoned': []})
        self.reject()

    def test_audit_findings(self):
        for field in ('advisories', 'abandoned', 'ignored-advisories', 'unreachable-repositories', 'filter', 'cooldown'):
            with self.subTest(field=field):
                self.write('composer-audit-locked.json', {'advisories': [], 'abandoned': [], field: ['finding']})
                self.reject()

    def test_unknown_audit_schema(self):
        self.write('composer-audit.json', {'advisories': [], 'abandoned': [], 'unknown': []})
        self.reject()

    def test_invalid_json(self):
        (self.root / 'composer-audit.json').write_text('{bad')
        self.reject()

    def test_duplicate_json_key(self):
        (self.root / 'composer-audit.json').write_text('{"advisories":[1],"advisories":[],"abandoned":[]}')
        self.reject()

    def test_missing_dev(self):
        self.write('installed.json', {'dev': False, 'packages': self.packages})
        self.reject()

    def test_wrong_versions(self):
        self.packages[0]['version'] = 'v13.0.0'
        self.write('installed.json', {'dev': True, 'packages': self.packages})
        self.reject()

    def test_wrong_stack_even_if_lock_matches(self):
        self.packages[0]['version'] = 'v13.0.0'
        self.write('installed.json', {'dev': True, 'packages': self.packages})
        self.write('composer.lock', {'packages': self.packages[:1], 'packages-dev': self.packages[1:]})
        self.reject()

    def test_insufficient_tests(self):
        self.suite.remove(self.suite[-1])
        self.suite.set('tests', '202')
        self.suite.set('assertions', '404')
        self.save_xml()
        self.reject()

    def test_failed_or_skipped_case(self):
        for kind in ('failure', 'error', 'skipped', 'warning'):
            with self.subTest(kind=kind):
                node = ET.SubElement(self.suite[0], kind)
                self.save_xml()
                self.reject()
                self.suite[0].remove(node)

    def test_forged_suite_count(self):
        self.suite.set('tests', '999')
        self.save_xml()
        self.reject()

    def test_duplicate_case(self):
        self.suite[2].set('name', self.suite[3].get('name'))
        self.save_xml()
        self.reject()

    def test_no_assertions(self):
        for case in self.suite:
            case.set('assertions', '0')
        self.suite.set('assertions', '0')
        self.save_xml()
        self.reject()

    def test_missing_cache_suite(self):
        self.suite[0].set('class', 'Other')
        self.save_xml()
        self.reject()

    def test_dtd(self):
        (self.root / 'phpunit.xml').write_text('<!DOCTYPE testsuites [<!ENTITY a "x">]><testsuites/>')
        self.reject()

    def test_wrong_marker(self):
        (self.root / 'resolution-started').write_text('other')
        self.reject()

    def test_manifest_policy(self):
        manifest = {'name': 'microweb/laravel-tiptap-editor'}
        self.write('composer.json', manifest)
        e.check_manifest(self.root / 'composer.json')
        for key in ('audit', 'policy', 'platform', 'disable-tls', 'secure-http'):
            with self.subTest(key=key):
                self.write('composer.json', {**manifest, 'config': {key: {}}})
                with self.assertRaises(ValueError):
                    e.check_manifest(self.root / 'composer.json')


if __name__ == '__main__':
    unittest.main(verbosity=2)
