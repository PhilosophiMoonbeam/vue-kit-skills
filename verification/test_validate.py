"""Exercise audit integrity through a standalone installed validator copy.

Run: python3 -m unittest discover -s verification -p 'test_*.py'
"""

import hashlib
import json
from pathlib import Path
import runpy
import shutil
import subprocess
import sys
import tempfile
import unittest


SKILL = Path(__file__).resolve().parents[1] / 'skills/vue-kit'
Validator = runpy.run_path(str(SKILL / 'scripts/validate.py'))['Validator']


class OpenVueAuditIntegrity(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='vue-kit-validator-')
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name) / 'vue-kit'
        for source in Validator(SKILL).packaged_paths():
            destination = self.root / source.relative_to(SKILL)
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, destination)
        self.audit_path = self.root / 'assets/openvue-coverage.json'
        self.audit = json.loads(self.audit_path.read_text(encoding='utf-8'))

    def validate(self, audit):
        self.audit_path.write_text(json.dumps(audit, ensure_ascii=True), encoding='utf-8')
        evidence_path = self.root / 'assets/verification.json'
        evidence = json.loads(evidence_path.read_text(encoding='utf-8'))
        # Corruption must be rejected by provenance, not an incidental stale hash.
        evidence['snapshots']['files']['assets/openvue-coverage.json'] = hashlib.sha256(
            self.audit_path.read_bytes()).hexdigest()
        evidence_path.write_text(json.dumps(evidence, ensure_ascii=True), encoding='utf-8')
        result = subprocess.run(
            [sys.executable, str(self.root / 'scripts/validate.py'), str(self.root), '--json'],
            capture_output=True, text=True, check=False,
        )
        self.assertIn(result.returncode, (0, 1), result.stderr)
        report = json.loads(result.stdout)
        self.assertFalse(any('packaged snapshot' in error for error in report['errors']), report)
        return result.returncode, report

    def assert_rejected(self, audit, diagnostic):
        status, report = self.validate(audit)
        self.assertEqual(status, 1, report)
        self.assertFalse(report['valid'], report)
        self.assertTrue(any(diagnostic in error for error in report['errors']), report)

    def test_healthy_installed_payload(self):
        status, report = self.validate(self.audit)
        self.assertEqual(status, 0, report)
        self.assertTrue(report['valid'], report)
        self.assertEqual(report['errors'], [])

    def test_discovery_policy_cannot_be_erased(self):
        self.audit['rubric'] = {}
        self.assert_rejected(self.audit, 'frozen OpenVue discovery inputs differ')

    def test_same_size_escalation_substitution_is_not_preserved_identity(self):
        old = self.audit['escalated'][0]
        new = next(row['id'] for row in self.audit['documents']
                   if row['id'] not in self.audit['escalated'])
        self.audit['escalated'][0] = new
        for row in self.audit['documents']:
            if row['id'] == old:
                row['escalated'] = False
            elif row['id'] == new:
                row['escalated'] = True
        self.assert_rejected(self.audit, 'frozen OpenVue discovery inputs differ')

    def test_retrievable_source_identity_cannot_be_replaced(self):
        self.audit['documents'][0]['source_url'] = 'https://example.invalid/'
        self.assert_rejected(self.audit, 'frozen OpenVue discovery inputs differ')

    def test_summary_counts_must_describe_actual_routes(self):
        for label in ('disposition_counts', 'reference_counts'):
            with self.subTest(summary=label):
                audit = json.loads(json.dumps(self.audit))
                key = next(iter(audit[label]))
                audit[label][key] += 1
                self.assert_rejected(audit, label)

    def test_invalid_unicode_policy_is_a_diagnostic_not_a_traceback(self):
        self.audit['escalation'] = '\ud800'
        self.assert_rejected(self.audit, 'cannot fingerprint frozen OpenVue discovery inputs')


if __name__ == '__main__':
    unittest.main()
