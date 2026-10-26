"""Exercise consumer-visible integrity through a standalone installed skill.

Run: python3 -m unittest discover -s verification -p 'test_*.py'
The fixtures change package data, never validator source or diagnostic wording.
"""

import copy
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


SKILL = Path(__file__).resolve().parents[1] / 'skills/vue-kit'
VERIFICATION = 'assets/verification.json'
CURRENT_AUDIT = 'assets/current-audit.json'


class InstalledPackageIntegrity(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='vue-kit-validator-')
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name) / 'vue-kit'
        shutil.copytree(SKILL, self.root, symlinks=True, ignore=shutil.ignore_patterns(
            '.git', 'node_modules', 'dist', '.vite', '__pycache__', '.venv'))
        self.assert_accepted('--refresh-footprint')

    def load(self, relative):
        return json.loads((self.root / relative).read_text(encoding='utf-8'))

    def write_json(self, relative, value, bind=True):
        (self.root / relative).write_text(json.dumps(value, ensure_ascii=True), encoding='utf-8')
        if bind and relative != VERIFICATION:
            self.bind(relative)

    def bind(self, relative):
        """Keep a data mutation current so a stale footprint cannot reject it."""
        report = self.load(VERIFICATION)
        report['snapshots']['files'][relative] = hashlib.sha256((self.root / relative).read_bytes()).hexdigest()
        self.write_json(VERIFICATION, report, bind=False)

    def invoke(self, *options):
        result = subprocess.run(
            [sys.executable, str(self.root / 'scripts/validate.py'), str(self.root), '--json', *options],
            cwd=self.root.parent, capture_output=True, text=True, check=False,
        )
        self.assertIn(result.returncode, (0, 1), result.stderr)
        self.assertEqual(result.stderr, '')
        report = json.loads(result.stdout)
        self.assertIsInstance(report['errors'], list)
        return result.returncode, report

    def assert_accepted(self, *options):
        status, report = self.invoke(*options)
        self.assertEqual(status, 0, report)
        self.assertTrue(report['valid'], report)
        self.assertEqual(report['errors'], [])
        return report

    def assert_rejected(self, *options):
        status, report = self.invoke(*options)
        self.assertEqual(status, 1, report)
        self.assertFalse(report['valid'], report)
        self.assertTrue(report['errors'], report)
        return report

    def current_audit(self):
        paths = sorted(
            path.relative_to(self.root).as_posix()
            for path in self.root.rglob('*')
            if path.is_file() and path != self.root / CURRENT_AUDIT
        )
        files = []
        for path in paths:
            unit = f'skills/vue-kit/{path}'
            files.append({
                'path': path, 'unit_ids': [unit], 'reviewed_unit_ids': [unit],
                'claim_evidence': [{
                    'unit_ids': [unit], 'claim': 'Structural fixture evidence only.',
                    'evidence_type': 'repository_source', 'source_url_or_pointer': path,
                    'version_scope': 'test fixture', 'disposition': 'source-confirmed',
                }],
            })
        return {
            'schema_version': 1, 'recorded_at': '2026-10-22T00:00:00Z',
            'scope': 'Schema fixture, not an actual content audit.',
            'rubric': {'scope': 'fixture'},
            'inventory': {
                'authored_files': len(files), 'audit_units': len(files),
                'escalated_units': len(files), 'unflagged_units': 0,
                'judge_errors': 0, 'truncated_units': 0,
                'dispositions': {'fixture': len(files)}, 'prefilter_exclusions': {},
            },
            'files': files, 'executions': [],
            'historical_limits': ['Fixture records do not authenticate source or runtime execution.'],
            'manual_gpu_confirmation': {
                'status': 'pending_user', 'bead_id': 'vue-kit-skills-liu.27',
                'scope': 'Final user observation.', 'limits': 'No browser/GPU execution in this fixture.',
            },
        }

    def test_healthy_installed_payload_needs_no_legacy_corpus(self):
        self.assertFalse((self.root / '.agents').exists())
        self.assertFalse((self.root / 'assets/example-app/node_modules').exists())
        self.assert_accepted()

    def test_frontmatter_requires_quotes_for_nonstring_yaml_numbers(self):
        path = self.root / 'SKILL.md'
        _, header, body = path.read_text(encoding='utf-8').split('---', 2)
        audit = self.load(CURRENT_AUDIT)
        added = set(audit['source_extension']['unit_ids'])
        owner = next(row for row in audit['files'] if row['path'] == 'SKILL.md')
        for evidence in owner['claim_evidence']:
            if added.intersection(evidence['unit_ids']):
                for excerpt in evidence['source_excerpts']:
                    excerpt['line'] += 1
        self.write_json(CURRENT_AUDIT, audit)
        for value in ('0xFF', '0o17', '0b10', '.5', '-.5e2'):
            with self.subTest(scalar=value):
                path.write_text(f'---{header}license: {value}\n---{body}', encoding='utf-8')
                self.bind('SKILL.md')
                self.assert_rejected()
                path.write_text(f'---{header}license: {json.dumps(value)}\n---{body}', encoding='utf-8')
                self.bind('SKILL.md')
                self.assert_accepted()

    def test_discovery_policy_cannot_be_erased(self):
        relative = 'assets/openvue-coverage.json'
        audit = self.load(relative)
        audit['rubric'] = {}
        self.write_json(relative, audit)
        self.assert_rejected()

    def test_same_size_escalation_substitution_is_rejected(self):
        relative = 'assets/openvue-coverage.json'
        audit = self.load(relative)
        old = audit['escalated'][0]
        new = next(row['id'] for row in audit['documents'] if row['id'] not in audit['escalated'])
        audit['escalated'][0] = new
        for row in audit['documents']:
            if row['id'] == old:
                row['escalated'] = False
            elif row['id'] == new:
                row['escalated'] = True
        self.write_json(relative, audit)
        self.assert_rejected()

    def test_retrievable_source_identity_cannot_be_replaced(self):
        relative = 'assets/openvue-coverage.json'
        audit = self.load(relative)
        audit['documents'][0]['source_url'] = 'https://example.invalid/'
        self.write_json(relative, audit)
        self.assert_rejected()

    def test_summary_counts_must_describe_actual_routes(self):
        relative = 'assets/openvue-coverage.json'
        original = self.load(relative)
        for label in ('disposition_counts', 'reference_counts'):
            with self.subTest(summary=label):
                audit = copy.deepcopy(original)
                key = next(iter(audit[label]))
                audit[label][key] += 1
                self.write_json(relative, audit)
                self.assert_rejected()

    def test_invalid_unicode_policy_is_rejected_without_a_traceback(self):
        relative = 'assets/openvue-coverage.json'
        audit = self.load(relative)
        audit['escalation'] = '\ud800'
        self.write_json(relative, audit)
        self.assert_rejected()

    def test_historical_native_source_hypothesis_cannot_be_replaced(self):
        relative = 'assets/coverage-audit.json'
        audit = self.load(relative)
        audit['sources'][0]['native'] = {}
        self.write_json(relative, audit)
        self.assert_rejected()

    def test_historical_reference_migration_keeps_original_identity(self):
        relative = 'assets/coverage-audit.json'
        audit = self.load(relative)
        row = next(item for item in audit['references'] if item['path'] == 'references/docs-vitepress.md')
        row['native_path'] = row['path']
        self.write_json(relative, audit)
        self.assert_rejected()

    def test_historical_reports_must_agree_on_snapshot_identity(self):
        for relative in ('assets/source-manifest.json', 'assets/source-audit.json', 'assets/coverage-audit.json'):
            with self.subTest(report=relative):
                original = self.load(relative)
                audit = copy.deepcopy(original)
                audit['history']['commit'] = '0' * 40
                self.write_json(relative, audit)
                self.assert_rejected()
                self.write_json(relative, original)

    def test_malformed_provenance_containers_are_diagnostics(self):
        for relative, field in (('assets/source-manifest.json', 'sources'), ('assets/source-audit.json', 'files')):
            original = self.load(relative)
            for value in (None, {}, 1):
                with self.subTest(report=relative, value=value):
                    audit = copy.deepcopy(original)
                    audit[field] = value
                    self.write_json(relative, audit)
                    self.assert_rejected()
            self.write_json(relative, original)

    def test_strict_json_rejects_duplicate_keys_and_nonfinite_numbers(self):
        relative = 'assets/openvue-coverage.json'
        original = self.load(relative)
        text = json.dumps(original)
        (self.root / relative).write_text('{"schema_version":1,' + text[1:], encoding='utf-8')
        self.bind(relative)
        self.assert_rejected()
        original['extra_metadata'] = float('nan')
        self.write_json(relative, original)
        self.assert_rejected()

    def test_local_links_fences_and_empty_payloads_are_rejected(self):
        path = self.root / 'references/core-vue.md'
        original = path.read_text(encoding='utf-8')
        for addition in ('\n[missing](absent.md)\n',
                         '\n[missing anchor](core-vue.md#absent-anchor)\n',
                         '\n```typescript\nconst unfinished = true\n'):
            with self.subTest(addition=addition):
                path.write_text(original + addition, encoding='utf-8')
                self.bind('references/core-vue.md')
                self.assert_rejected()
        path.write_text(original, encoding='utf-8')
        self.bind('references/core-vue.md')
        (self.root / 'assets/example-app/index.html').write_bytes(b'')
        self.bind('assets/example-app/index.html')
        self.assert_rejected()

    def test_example_dependency_pins_and_script_declarations_are_required(self):
        relative = 'assets/example-app/package.json'
        original = self.load(relative)
        package = copy.deepcopy(original)
        package['dependencies']['vue'] = '^' + package['dependencies']['vue']
        self.write_json(relative, package)
        self.assert_rejected()
        package = copy.deepcopy(original)
        package['scripts']['build'] = 'echo skipped'
        self.write_json(relative, package)
        self.assert_rejected()
        for group, name in (('dependencies', '@tresjs/core'), ('dependencies', 'three'),
                            ('devDependencies', '@types/three')):
            package = copy.deepcopy(original)
            package[group].pop(name)
            with self.subTest(missing_graphics_contract=name):
                self.write_json(relative, package)
                self.assert_rejected()

    def test_footprint_detects_changed_unlisted_and_missing_files(self):
        path = self.root / 'assets/example-app/index.html'
        before = path.read_bytes()
        path.write_bytes(before + b'\n')
        self.assert_rejected()
        path.write_bytes(before)
        extra = self.root / 'assets/unlisted.txt'
        extra.write_text('unlisted payload', encoding='utf-8')
        self.assert_rejected()
        extra.unlink()
        path.unlink()
        self.assert_rejected()

    def test_unsafe_or_self_referential_snapshots_are_rejected_even_on_refresh(self):
        original = self.load(VERIFICATION)
        for name in ('../outside.txt', '/outside.txt', 'assets/../SKILL.md', VERIFICATION):
            with self.subTest(path=name):
                report = copy.deepcopy(original)
                report['snapshots']['files'][name] = '0' * 64
                self.write_json(VERIFICATION, report)
                self.assert_rejected('--refresh-footprint')

    def test_escaping_and_cyclic_symlinks_are_rejected(self):
        outside = self.root.parent / 'outside.txt'
        outside.write_text('outside skill', encoding='utf-8')
        link = self.root / 'assets/escape.txt'
        link.symlink_to(outside)
        self.assert_rejected('--refresh-footprint')
        link.unlink()
        link.symlink_to(self.root / 'assets', target_is_directory=True)
        self.assert_rejected('--refresh-footprint')

    def test_removed_recipes_and_dependencies_cannot_be_reintroduced(self):
        path = self.root / 'references/core-vue.md'
        original = path.read_text(encoding='utf-8')
        path.write_text(original + '\n```sh\nbun add @slidev/cli\n```\n', encoding='utf-8')
        self.bind('references/core-vue.md')
        self.assert_rejected()
        path.write_text(original, encoding='utf-8')
        self.bind('references/core-vue.md')
        relative = 'assets/example-app/package.json'
        package = self.load(relative)
        package['dependencies']['excluded-alias'] = 'npm:@slidev/cli@53.0.0'
        self.write_json(relative, package)
        self.assert_rejected()

    def test_successor_ancestry_does_not_allow_duplicate_or_vendor_guidance(self):
        relative = 'references/openvue.md'
        path = self.root / relative
        original = path.read_text(encoding='utf-8')
        ancestry = next(line for line in original.splitlines() if 'a fork of' in line)
        for addition in (ancestry, 'Install PrimeVue to enable additional components.'):
            with self.subTest(addition=addition):
                path.write_text(original + '\n' + addition + '\n', encoding='utf-8')
                self.bind(relative)
                self.assert_rejected()

    def test_service_independent_boundary_is_not_bypassed_by_audit_metadata(self):
        audit = self.current_audit()
        audit['scope'] = 'Reintroduce clerk as active guidance.'
        self.write_json(CURRENT_AUDIT, audit)
        self.assert_rejected()

    def test_refresh_changes_only_footprint_and_preserves_historical_records(self):
        before = self.load(VERIFICATION)
        path = self.root / 'assets/example-app/index.html'
        path.write_bytes(path.read_bytes() + b'\n')
        extra = self.root / 'assets/consumer-note.txt'
        extra.write_text('packaged consumer data', encoding='utf-8')
        self.assert_rejected()
        # A footprint refresh cannot silently enlarge the audited inventory.
        self.assert_rejected('--refresh-footprint')
        self.write_json(CURRENT_AUDIT, self.current_audit())
        result = self.assert_accepted('--refresh-footprint')
        self.assertTrue(result['footprint_refreshed'])
        after = self.load(VERIFICATION)
        old_map = before.pop('snapshots')
        new_map = after.pop('snapshots')
        self.assertEqual(before, after)
        self.assertEqual(new_map['algorithm'], old_map['algorithm'])
        self.assertNotIn(VERIFICATION, new_map['files'])
        self.assertEqual(new_map['files']['assets/example-app/index.html'], hashlib.sha256(path.read_bytes()).hexdigest())
        self.assertEqual(new_map['files']['assets/consumer-note.txt'], hashlib.sha256(extra.read_bytes()).hexdigest())
        self.assert_accepted()
        extra.unlink()
        self.write_json(CURRENT_AUDIT, self.current_audit())
        self.assert_accepted('--refresh-footprint')
        self.assertNotIn('assets/consumer-note.txt', self.load(VERIFICATION)['snapshots']['files'])

    def test_refresh_refuses_structural_corruption_without_writing_evidence(self):
        (self.root / 'SKILL.md').unlink()
        evidence = (self.root / VERIFICATION).read_bytes()
        report = self.assert_rejected('--refresh-footprint')
        self.assertFalse(report['footprint_refreshed'])
        self.assertEqual((self.root / VERIFICATION).read_bytes(), evidence)

    def test_current_audit_is_complete_and_refresh_preserves_it(self):
        audit = self.current_audit()
        self.write_json(CURRENT_AUDIT, audit)
        self.assert_accepted()
        before = self.load(VERIFICATION)
        self.assert_accepted('--refresh-footprint')
        after = self.load(VERIFICATION)
        self.assertEqual(before, after)
        self.assertEqual(after['snapshots']['files'][CURRENT_AUDIT], hashlib.sha256((self.root / CURRENT_AUDIT).read_bytes()).hexdigest())

    def test_current_audit_rejects_missing_duplicate_and_unowned_units(self):
        original = self.current_audit()
        variants = []
        missing = copy.deepcopy(original)
        missing['files'].pop()
        variants.append(missing)
        duplicate = copy.deepcopy(original)
        duplicate['files'][1] = copy.deepcopy(duplicate['files'][0])
        variants.append(duplicate)
        unowned = copy.deepcopy(original)
        unowned['files'][0]['unit_ids'] = ['skills/vue-kit/not-the-owning-file.md:1-2']
        variants.append(unowned)
        no_evidence = copy.deepcopy(original)
        no_evidence['files'][0]['claim_evidence'] = []
        variants.append(no_evidence)
        wrong_total = copy.deepcopy(original)
        wrong_total['inventory']['audit_units'] += 1
        variants.append(wrong_total)
        for index, audit in enumerate(variants):
            with self.subTest(corruption=index):
                self.write_json(CURRENT_AUDIT, audit)
                self.assert_rejected()

    def test_current_audit_rejects_plans_as_observed_executions_or_gpu_acceptance(self):
        audit = self.current_audit()
        audit['executions'] = [{
            'id': 'not-observed', 'command': 'browser-check', 'scope': 'fixture',
            'outcome': 'planned', 'observations': 'Not executed.',
        }]
        self.write_json(CURRENT_AUDIT, audit)
        self.assert_rejected()
        audit['executions'] = []
        audit['manual_gpu_confirmation']['status'] = 'passed'
        self.write_json(CURRENT_AUDIT, audit)
        self.assert_rejected()

    def test_reviewed_gpu_baseline_requires_receipt_and_pending_corrected_device_gate(self):
        audit = self.current_audit()
        gpu = audit['manual_gpu_confirmation']
        gpu.update({
            'status': 'reviewed_with_limits',
            'reviewed_report': {
                'filename': 'webgpu-lab-fixture.json', 'exported_at': '2026-10-25T17:29:07Z',
                'sha256': 'a' * 64, 'bytes': 123,
                'observations': ['Schema fixture only, not a real GPU observation.'],
            },
            'followup': {
                'status': 'pending_user', 'bead_id': 'vue-kit-skills-liu.33.3',
                'scope': 'Corrected source still needs target-device evidence.',
            },
        })
        self.write_json(CURRENT_AUDIT, audit)
        self.assert_accepted()
        for field, value in (
            ('reviewed_report', None),
            ('followup', {'status': 'passed', 'bead_id': 'vue-kit-skills-liu.33.3'}),
        ):
            invalid = copy.deepcopy(audit)
            invalid['manual_gpu_confirmation'][field] = value
            with self.subTest(missing_or_fabricated=field):
                self.write_json(CURRENT_AUDIT, invalid)
                self.assert_rejected()
        for field, value in (('sha256', []), ('bytes', True), ('observations', [])):
            invalid = copy.deepcopy(audit)
            invalid['manual_gpu_confirmation']['reviewed_report'][field] = value
            with self.subTest(invalid_receipt=field):
                self.write_json(CURRENT_AUDIT, invalid)
                self.assert_rejected()
        followup = gpu['followup']
        followup['status'] = 'reviewed_with_limits'
        followup['reviewed_report'] = copy.deepcopy(gpu['reviewed_report'])
        self.write_json(CURRENT_AUDIT, audit)
        self.assert_accepted()
        for value in (None, {'sha256': 'not-a-digest', 'bytes': True}):
            followup['reviewed_report'] = value
            with self.subTest(unattributable_followup=value):
                self.write_json(CURRENT_AUDIT, audit)
                self.assert_rejected()

    def test_workbench_source_extension_preserves_original_population_on_refresh(self):
        audit = self.load(CURRENT_AUDIT)
        extension = audit['source_extension']
        original = extension['original_inventory']
        self.assertEqual(audit['inventory']['authored_files'],
                         original['authored_files'] + len(extension['new_files']))
        self.assertEqual(audit['inventory']['audit_units'],
                         original['audit_units'] + len(extension['unit_ids']))
        self.assert_accepted('--refresh-footprint')
        self.assertEqual(self.load(CURRENT_AUDIT), audit)

    def test_workbench_source_extension_rejects_lost_or_mixed_review_coverage(self):
        original = self.load(CURRENT_AUDIT)
        unit = original['source_extension']['unit_ids'][0]
        variants = []
        missing_extension = copy.deepcopy(original)
        missing_extension.pop('source_extension')
        variants.append(missing_extension)
        undeclared = copy.deepcopy(original)
        undeclared['source_extension']['unit_ids'].remove(unit)
        variants.append(undeclared)
        missing_file = copy.deepcopy(original)
        missing_file['source_extension']['new_files'].pop()
        variants.append(missing_file)
        for mutation in ('unreviewed', 'unevidenced', 'execution_disposition', 'mixed_original',
                         'stale_excerpt', 'missing_excerpts'):
            audit = copy.deepcopy(original)
            owner = next(row for row in audit['files'] if unit in row['unit_ids'])
            evidence = next(row for row in owner['claim_evidence'] if unit in row['unit_ids'])
            if mutation == 'unreviewed':
                owner['reviewed_unit_ids'].remove(unit)
            elif mutation == 'unevidenced':
                owner['claim_evidence'].remove(evidence)
            elif mutation == 'execution_disposition':
                evidence['disposition'] = 'passed'
            elif mutation == 'stale_excerpt':
                evidence['source_excerpts'][0]['text'] += ' not present in the source'
            elif mutation == 'missing_excerpts':
                evidence.pop('source_excerpts')
            else:
                frozen_owner = next(row for row in audit['files']
                                    if any(item not in audit['source_extension']['unit_ids']
                                           for item in row['unit_ids']))
                evidence['unit_ids'].append(frozen_owner['unit_ids'][0])
            variants.append(audit)
        for index, audit in enumerate(variants):
            with self.subTest(corruption=index):
                self.write_json(CURRENT_AUDIT, audit)
                self.assert_rejected()

    def test_workbench_source_extension_rejects_relabelled_original_identity_and_counts(self):
        original = self.load(CURRENT_AUDIT)
        relabelled = copy.deepcopy(original)
        added = set(relabelled['source_extension']['unit_ids'])
        owner = next(row for row in relabelled['files'] if any(unit not in added for unit in row['unit_ids']))
        before = next(unit for unit in owner['unit_ids'] if unit not in added)
        after = f"skills/vue-kit/{owner['path']}#substituted-original"
        owner['unit_ids'] = [after if unit == before else unit for unit in owner['unit_ids']]
        owner['reviewed_unit_ids'] = [after if unit == before else unit for unit in owner['reviewed_unit_ids']]
        for evidence in owner['claim_evidence']:
            evidence['unit_ids'] = [after if unit == before else unit for unit in evidence['unit_ids']]
        wrong_original = copy.deepcopy(original)
        wrong_original['source_extension']['original_inventory']['audit_units'] += 1
        wrong_current = copy.deepcopy(original)
        wrong_current['inventory']['dispositions']['source_reviewed_extension'] -= 1
        wrong_current['inventory']['dispositions']['evidence_supported'] += 1
        for index, audit in enumerate((relabelled, wrong_original, wrong_current)):
            with self.subTest(corruption=index):
                self.write_json(CURRENT_AUDIT, audit)
                self.assert_rejected()

    def test_malformed_current_audit_is_a_diagnostic(self):
        for value in ([], None, {'schema_version': 1}):
            with self.subTest(value=value):
                self.write_json(CURRENT_AUDIT, value)
                self.assert_rejected()


if __name__ == '__main__':
    unittest.main()
