#!/usr/bin/env python3
"""Validate an installed Vue Kit skill using Python 3.9+ and its standard library.

Usage: python3 scripts/validate.py [ROOT] [--json] [--refresh-footprint]

The frontmatter reader deliberately supports a small YAML subset: top-level
string fields, a two-space-indented metadata string map, quoted/plain scalars,
and literal/folded block strings (|, |-, |+, >, >-, >+). Folded blocks accept
one plain paragraph; other YAML constructs are rejected, never evaluated.
This checks packaged structure and provenance consistency, not example runtime
behavior, upstream truth, or the availability of original source documents.
Markdown checks cover this package's flat headings, fences and local links,
not full CommonMark conformance. Lockfile presence is not lock resolution.
An optional assets/current-audit.json is checked for inventory/evidence schema
consistency and included in the footprint, not independently authenticated.
--refresh-footprint replaces only snapshots.files after the other checks pass;
it does not alter recorded checks, timestamps or historical source identities,
and it does not establish that changed examples have been executed.
"""

import argparse
from collections import Counter
from datetime import datetime
import hashlib
import html
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import sys
import unicodedata
import tempfile
from urllib.parse import unquote, urlsplit


BASELINE = {"vue": "3.5.44", "vuetify": "4.3.0"}
HISTORY_COMMIT = '7bf433b98951918c694358e372d3b02cf6f982e5'
IGNORED = {".git", "node_modules", "dist", ".vite", "__pycache__", ".venv"}
SEMVER = re.compile(r"\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?\Z")
# Fingerprints preserve the accepted native hypotheses, including probabilities,
# independently of the later primary-evidence resolutions.
# These are historical-integrity checks, not proof of audit or runtime execution.
NATIVE_FINGERPRINTS = {
    'sources': '4ead9391a8b08445619f6dc719ea4a0ef3e1db603873817a45364939e0830c16',
    'references': '4e81026e20777414d4a0c2871fa207c79d1668ed3f3f5b9e1bc65867184355c2',
    'openvue-documents': '2c668b838114fb39e8fb83174d2c61a87030ef9f7b3a180ddabd7f7aaa43bb14',
}
NATIVE_COUNTS = {
    'native_source_choices': {'covered': 331, 'partial': 126, 'missing': 1, 'out_of_scope': 1},
    'native_reference_readiness': {'ready': 37, 'mixed': 1},
}

# Bind discovery policy, escalation identities and retrievable source metadata
# separately from native judgments and editable semantic routing dispositions.
OPENVUE_INPUT_FIELDS = ('rubric', 'input_cap', 'escalation', 'truncated', 'escalated', 'native_errors')
OPENVUE_SOURCE_FIELDS = (
    'source_kind', 'source_path', 'source_url', 'bytes', 'truncated', 'escalated',
    'source_identity_sha256', 'source_blob_sha1',
)
OPENVUE_INPUT_FINGERPRINT = '0545c91984a36770067d15a862975eccd58c5a712ce89204ca186e345b9692da'

# Original current-audit population only; not source truth or execution authentication.
CURRENT_AUDIT_ORIGINAL_POPULATION = '0c334b90bdbbcdd1a2195f56114c28569d53c935e3cdf0a3c50e049073bf2eb7'

# Current additions are reviewed separately from the immutable 38-reference
# native population. Declaring a new file here requires its own extension review.
CURRENT_REFERENCE_EXTENSIONS = (
    'references/nuxt.md',
    'references/nuxt-integrations.md',
    'references/openvue.md',
    'references/openvue-setup.md',
    'references/openvue-theming.md',
    'references/openvue-forms.md',
    'references/openvue-data.md',
    'references/openvue-overlays.md',
    'references/openvue-navigation.md',
    'references/openvue-components.md',
)
HISTORICAL_REFERENCE_COUNT = 38
ACTIVE_REFERENCE_COUNT = HISTORICAL_REFERENCE_COUNT + len(CURRENT_REFERENCE_EXTENSIONS)

# This ledger entry is a shipped exclusion, not a compatibility alias or a scan
# of historical audit facts. Native hypotheses retain their original identity.
REMOVAL_ID = 'slidev-twoslash-floating-vue'
REMOVED_ROOT = 'slidev-cli-skilld'
OLD_GUIDE = 'references/docs-slides.md'
VITEPRESS_GUIDE = 'references/docs-vitepress.md'
REMOVAL_REFERENCE = 'references/sources.md'
REMOVAL_SECTION = 'Slidev, Twoslash, and FloatingVue'
REMOVAL_ANCHOR = 'slidev-twoslash-and-floatingvue'
EXCLUSION_QUOTE = ('Slidev and its Twoslash/FloatingVue integration are removed from the shipped Vue Kit '
                   'capability set; their source records are historical exclusions, not supported implementation guidance.')
REMOVED_PACKAGES = {
    '@slidev/cli': '53.0.0',
    '@slidev/client': '53.0.0',
    '@shikijs/vitepress-twoslash': '4.5.0',
    'floating-vue': '5.4.0',
}
REINTRODUCTION_REQUIREMENTS = (
    'A supported compatible source or release fix repairs the integration defect; a latest tag alone is insufficient.',
    'Clean startup in a real browser without the FloatingVue patch failure, workaround, shim or log suppression.',
    'Verified tooltip, type-query and completion behavior plus drag/text-selection acceptance through keyboard and pointer interactions.',
    'Verified production behavior and integration on the Vue 3.5.44 baseline, not only a successful build.',
)
REMOVED_TERMS = re.compile(r'(?i)(?<![\w])(?:slidev|twoslash|floating-vue|floatingvue)(?![\w])')


class FrontmatterError(ValueError):
    pass


def scalar(value, line):
    """Read strings only; never silently coerce YAML booleans or numbers."""
    value = value.strip()
    if not value:
        raise FrontmatterError(f"line {line}: expected a string value")
    if value.startswith('"'):
        try:
            result, end = json.JSONDecoder().raw_decode(value)
        except ValueError as exc:
            raise FrontmatterError(f"line {line}: unsupported quoted string: {exc}") from exc
        if not isinstance(result, str) or (value[end:].strip() and not value[end:].lstrip().startswith('#')):
            raise FrontmatterError(f"line {line}: expected one quoted string")
        return result
    if value.startswith("'"):
        match = re.fullmatch(r"'((?:[^']|'')*)'\s*(?:#.*)?", value)
        if not match:
            raise FrontmatterError(f"line {line}: invalid single-quoted string")
        return match[1].replace("''", "'")
    value = re.split(r"\s+#", value, maxsplit=1)[0].rstrip()
    if (value[0] in "[]{}&*!|>@`%#,?" or re.search(r":(?:\s|$)", value)
            or re.fullmatch(r"[-?:](?:\s.*)?", value)):
        raise FrontmatterError(f"line {line}: unsupported YAML syntax; quote this string")
    if re.fullmatch(r"(?i:null|true|false|yes|no|on|off|~|[-+]?(?:\d[\d_.eE+-]*|0[xob][0-9a-f_]+|\.\d+(?:e[-+]?\d+)?|\.inf|\.nan))", value):
        raise FrontmatterError(f"line {line}: non-string YAML scalar; quote this value")
    return value


def frontmatter(text):
    lines = text.splitlines()
    if not lines or lines[0] != '---':
        raise FrontmatterError("must start with a --- frontmatter delimiter")
    try:
        end = lines.index('---', 1)
    except ValueError as exc:
        raise FrontmatterError("missing closing --- frontmatter delimiter") from exc
    result = {}
    i = 1
    metadata = False
    while i < end:
        row = lines[i]
        if not row.strip() or row.lstrip().startswith('#'):
            i += 1
            continue
        if '\t' in row:
            raise FrontmatterError(f"line {i + 1}: tabs are unsupported in frontmatter")
        nested = row.startswith('  ') and not row.startswith('   ')
        if row.startswith(' ') and not (nested and metadata):
            raise FrontmatterError(f"line {i + 1}: unsupported indentation")
        match = re.fullmatch(r"(  )?([A-Za-z0-9_-]+):(?:\s+(.*))?", row)
        if not match:
            raise FrontmatterError(f"line {i + 1}: unsupported YAML mapping syntax")
        key, value = match[2], match[3] or ''
        target = result['metadata'] if nested else result
        if key in target:
            raise FrontmatterError(f"line {i + 1}: duplicate key {key!r}")
        if not nested:
            metadata = key == 'metadata'
            if metadata:
                if value.strip() not in ('', '{}'):
                    raise FrontmatterError(f"line {i + 1}: metadata must be a string mapping")
                result[key] = {}
                metadata = not value.strip()
                i += 1
                continue
        if value.strip() in ('|', '|-', '|+', '>', '>-', '>+'):
            marker = value.strip()
            indent = 4 if nested else 2
            block = []
            i += 1
            while i < end and (not lines[i].strip() or lines[i].startswith(' ' * indent)):
                block.append(lines[i][indent:] if lines[i].strip() else '')
                i += 1
            if not block:
                raise FrontmatterError(f"line {i + 1}: empty block string")
            if marker.startswith('>'):
                content = list(block)
                trailing = 0
                while content and not content[-1]:
                    content.pop()
                    trailing += 1
                if any(not part or part.startswith(' ') for part in content):
                    raise FrontmatterError(f"line {i + 1}: folded blocks support one plain paragraph; use a literal block for blank or indented lines")
                parsed = ' '.join(content) + '\n' * (trailing + 1)
            else:
                parsed = '\n'.join(block) + '\n'
            target[key] = parsed.rstrip('\n') if marker.endswith('-') else parsed if marker.endswith('+') else parsed.rstrip('\n') + '\n'
            continue
        target[key] = scalar(value, i + 1)
        i += 1
    return result, '\n'.join(lines[end + 1:])


def prose_lines(text, error):
    """Exclude top-level fences; require closure as a package authoring policy."""
    output = []
    fence = None
    for number, row in enumerate(text.splitlines(), 1):
        match = re.match(r"^ {0,3}(`{3,}|~{3,})(.*)$", row)
        if fence:
            if match and match[1][0] == fence[0] and len(match[1]) >= fence[1] and not match[2].strip():
                fence = None
            output.append('')
        elif match and not (match[1][0] == '`' and '`' in match[2]):
            fence = (match[1][0], len(match[1]), number)
            output.append('')
        else:
            output.append(row)
    if fence:
        error(f"line {fence[2]}: unclosed {fence[0]} code fence")
    return output


def slug(text):
    text = re.sub(r'<[^>]*>', '', html.unescape(text)).lower()
    text = re.sub(r'!?\[([^\]]*)\]\([^)]*\)', r'\1', text)
    text = ''.join(char for char in text if char in '-_ ' or unicodedata.category(char)[0] in 'LN' or char.isspace())
    return re.sub(r'\s', '-', text.strip())


class Tags(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.anchors = set()
        self.links = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for key in ('id', 'name'):
            if attrs.get(key) and (key == 'id' or tag == 'a'):
                self.anchors.add(attrs[key])
        for key in ('href', 'src'):
            if attrs.get(key):
                self.links.append((self.getpos()[0], attrs[key]))


def without_code(text):
    return re.sub(r'(`+)(?!`)(.*?)\1(?!`)', '', text)


def destination(text):
    """Parse a Markdown destination, excluding its optional link title."""
    text = text.strip()
    if text.startswith('<'):
        end = text.find('>')
        return text[1:end] if end >= 0 else None
    match = re.match(r"(?:\\.|[^\s])+", text)
    return re.sub(r'\\([!"#$%&\'()*+,\-./:;<=>?@\[\]\\^_`{|}~])', r'\1', match[0]) if match else None


def markdown_links(lines, error):
    definitions = {}
    links = []
    normal = []
    normalize = lambda value: ' '.join(value.split()).casefold()
    for number, row in enumerate(lines, 1):
        match = re.match(r'^ {0,3}\[([^\]]+)\]:\s*(.*)$', row)
        if match:
            target = destination(match[2])
            if target is None:
                error(f"line {number}: invalid reference link destination")
            else:
                definitions[normalize(match[1])] = target
                links.append((number, target))
            normal.append('')
        else:
            normal.append(without_code(row))
    for number, row in enumerate(normal, 1):
        # Balanced destination parentheses allow paths such as example(a).md.
        for match in re.finditer(r'(?<!\\)!?\[((?:[^\[\]\\]|\\.|\[(?:[^\[\]\\]|\\.)*\])*)\]', row):
            label = match[1]
            end = match.end()
            if end < len(row) and row[end] == '(':
                depth, pos = 1, end + 1
                escaped = False
                angle = False
                while pos < len(row):
                    char = row[pos]
                    if escaped:
                        escaped = False
                    elif char == '\\':
                        escaped = True
                    elif char == '<':
                        angle = True
                    elif char == '>':
                        angle = False
                    elif not angle and char == '(':
                        depth += 1
                    elif not angle and char == ')':
                        depth -= 1
                        if depth == 0:
                            break
                    pos += 1
                if depth:
                    error(f"line {number}: unclosed Markdown link")
                else:
                    target = destination(row[end + 1:pos])
                    if target is not None:
                        links.append((number, target))
            elif end < len(row) and row[end] == '[':
                close = row.find(']', end + 1)
                if close >= 0:
                    key = normalize(row[end + 1:close] or label)
                    if key not in definitions:
                        error(f"line {number}: undefined link reference {key!r}")
                    else:
                        links.append((number, definitions[key]))
            elif normalize(label) in definitions:
                links.append((number, definitions[normalize(label)]))
    return links


def markdown_headings(lines):
    """Yield canonical headings with their zero-based source line and slug."""
    used = set()
    for index, row in enumerate(lines):
        heading = re.match(r'^ {0,3}#{1,6}\s+(.+?)(?:\s+#+\s*)?$', row)
        title = heading[1] if heading else None
        if index + 1 < len(lines) and re.fullmatch(r' {0,3}(?:=+|-+)\s*', lines[index + 1]) and row.strip():
            title = row.strip()
        if title is not None:
            base = slug(title)
            anchor = base
            number = 0
            while anchor in used:
                number += 1
                anchor = f'{base}-{number}'
            used.add(anchor)
            yield index, title, anchor


def document(text, error):
    lines = prose_lines(text, error)
    anchors = {anchor for _, _, anchor in markdown_headings(lines)}
    tags = Tags()
    tags.feed('\n'.join(without_code(row) for row in lines))
    return anchors | tags.anchors, markdown_links(lines, error) + tags.links


class Validator:
    def __init__(self, root):
        self.root = root.resolve()
        self.errors = []
        self.checks = []
        self.documents = {}
        self.indexed = set()
        self.references = set()
        self.reference_bodies = {}
        self.packaged_files = None
        self.manifest = None
        self.audit = None
        self.verification = None
        self.current_footprint = {}

    def display(self, path):
        try:
            return path.relative_to(self.root).as_posix()
        except ValueError:
            return str(path)

    def error(self, path, message):
        diagnostic = f'{self.display(path)}: {message}'
        self.errors.append(diagnostic.encode('utf-8', errors='backslashreplace').decode('utf-8'))

    def safe_path(self, owner, value, label):
        """Require canonical POSIX relative paths and contain resolved symlinks."""
        if (not isinstance(value, str) or not value or '\\' in value
                or '\x00' in value or re.match(r'^[A-Za-z]:', value)
                or value.startswith('/') or any(part in ('', '.', '..') for part in value.split('/'))):
            self.error(owner, f'{label}: expected a safe skill-relative path')
            return None
        path = self.root / value
        try:
            if not path.resolve().is_relative_to(self.root):
                self.error(owner, f'{label}: path escapes skill root')
                return None
        except (OSError, RuntimeError, ValueError, UnicodeError) as exc:
            self.error(owner, f'{label}: cannot resolve path: {exc}')
            return None
        return path

    def packaged_paths(self):
        """Walk once, pruning ignored directories and containing symlink targets."""
        if self.packaged_files is not None:
            return self.packaged_files
        files = []

        def walk(directory, ancestors):
            try:
                resolved = directory.resolve()
                if resolved in ancestors:
                    self.error(directory, 'directory symlink cycle')
                    return
                with os.scandir(directory) as entries:
                    children = sorted(entries, key=lambda entry: entry.name)
                for entry in children:
                    path = Path(entry.path)
                    try:
                        is_directory = entry.is_dir()
                        if is_directory and entry.name in IGNORED:
                            continue
                        if not path.resolve().is_relative_to(self.root):
                            self.error(path, 'symlink escapes skill root')
                            continue
                        if is_directory:
                            walk(path, ancestors | {resolved})
                        elif entry.is_file():
                            files.append(path)
                        else:
                            self.error(path, 'packaged entry is not a regular file or directory')
                    except (OSError, RuntimeError, ValueError, UnicodeError) as exc:
                        self.error(path, f'cannot inspect packaged entry: {exc}')
            except (OSError, RuntimeError, ValueError, UnicodeError) as exc:
                self.error(directory, f'cannot enumerate packaged directory: {exc}')

        walk(self.root, set())
        self.packaged_files = sorted(files)
        return self.packaged_files

    def load_json(self, relative):
        path = self.root / relative
        if self.safe_path(path, relative, 'JSON path') is None:
            return None
        try:
            def unique(pairs):
                result = {}
                for key, value in pairs:
                    if key in result:
                        raise ValueError(f'duplicate JSON key {key!r}')
                    result[key] = value
                return result
            def invalid_constant(value):
                raise ValueError(f'non-finite JSON number {value}')
            return json.loads(path.read_text(encoding='utf-8'), object_pairs_hook=unique, parse_constant=invalid_constant)
        except (OSError, UnicodeError, ValueError, RecursionError) as exc:
            self.error(path, f'cannot read JSON: {exc}')
            return None

    def validate_frontmatter(self, path, text):
        self.checks.append('master frontmatter and line limit')
        if len(text.splitlines()) >= 500:
            self.error(path, 'master must contain fewer than 500 lines')
        try:
            fields, body = frontmatter(text)
        except FrontmatterError as exc:
            self.error(path, str(exc))
            return text
        allowed = {'name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools'}
        for key in sorted(fields.keys() - allowed):
            self.error(path, f'unsupported frontmatter field {key!r}')
        name = fields.get('name', '')
        if not isinstance(name, str) or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', name) or len(name) > 64:
            self.error(path, 'name must be 1–64 lowercase ASCII letters/digits with single internal hyphens')
        if name != self.root.name:
            self.error(path, f'name {name!r} must match skill directory {self.root.name!r}')
        for key, limit in (('description', 1024), ('compatibility', 500)):
            if key not in fields and key != 'description':
                continue
            value = fields.get(key)
            if not isinstance(value, str) or not value.strip() or len(value) > limit:
                self.error(path, f'{key} must be a nonempty string of at most {limit} characters')
        for key in ('license', 'allowed-tools'):
            if key in fields and (not isinstance(fields[key], str) or not fields[key].strip()):
                self.error(path, f'{key} must be a nonempty string')
        if 'metadata' in fields and (not isinstance(fields['metadata'], dict) or any(not isinstance(k, str) or not isinstance(v, str) for k, v in fields['metadata'].items())):
            self.error(path, 'metadata must map string keys to string values')
        if not body.strip():
            self.error(path, 'master body must not be empty')
        return '\n' * (text.splitlines().index('---', 1) + 1) + body

    def validate_documents(self):
        self.checks.extend(['nonempty packaged files', 'balanced Markdown fences', 'local Markdown links and anchors', 'direct master reference index'])
        master = self.root / 'SKILL.md'
        if not master.is_file():
            self.error(master, 'required master file is missing')
        for path in self.packaged_paths():
            try:
                if path.stat().st_size == 0:
                    self.error(path, 'file is empty')
                if path.suffix.lower() != '.md':
                    continue
                text = path.read_text(encoding='utf-8')
                if not text.strip():
                    self.error(path, 'Markdown file is whitespace-only')
                if path == master:
                    text = self.validate_frontmatter(path, text)
                self.documents[path] = document(text, lambda message: self.error(path, message))
                if path.parent == self.root / 'references':
                    self.cache_reference(path, text)
            except (OSError, UnicodeError) as exc:
                self.error(path, f'cannot read file: {exc}')
        refs = self.root / 'references'
        self.references = {path for path in self.documents if path.parent == refs}
        for path in self.documents:
            if refs in path.parents and path.parent != refs:
                self.error(path, 'reference Markdown must be in the flat references directory')
        if not self.references:
            self.error(refs, 'no reference Markdown files found')
        for owner, (_, links) in sorted(self.documents.items()):
            for number, target in links:
                try:
                    parsed = urlsplit(html.unescape(target))
                except ValueError as exc:
                    self.error(owner, f'line {number}: invalid link {target!r}: {exc}')
                    continue
                if parsed.scheme or parsed.netloc:
                    continue
                try:
                    path = (owner.parent / unquote(parsed.path)).resolve() if parsed.path else owner
                except (OSError, RuntimeError, ValueError, UnicodeError) as exc:
                    self.error(owner, f'line {number}: invalid local link {target!r}: {exc}')
                    continue
                if not path.is_relative_to(self.root):
                    self.error(owner, f'line {number}: link escapes skill root: {target!r}')
                    continue
                if not path.exists():
                    self.error(owner, f'line {number}: missing local link target {target!r}')
                    continue
                if owner == master and path in self.references:
                    self.indexed.add(path)
                if parsed.fragment:
                    if path not in self.documents:
                        self.error(owner, f'line {number}: cannot resolve Markdown anchor in {target!r}')
                    elif unquote(parsed.fragment) not in self.documents[path][0]:
                        self.error(owner, f'line {number}: missing anchor in {target!r}')
        for path in sorted(self.references - self.indexed):
            self.error(master, f'reference not directly linked: {self.display(path)}')

    def validate_provenance(self):
        self.checks.append('source manifest schema, coverage, and audit snapshot consistency')
        manifest_path = self.root / 'assets/source-manifest.json'
        audit_path = self.root / 'assets/source-audit.json'
        manifest = self.load_json('assets/source-manifest.json')
        audit = self.load_json('assets/source-audit.json')
        self.manifest, self.audit = manifest, audit
        if not isinstance(manifest, dict):
            if manifest is not None:
                self.error(manifest_path, 'manifest must be an object')
            return
        if set(manifest) != {'schema_version', 'baseline', 'sources', 'extensions', 'history'}:
            self.error(manifest_path, 'expected schema_version, baseline, sources, extensions, history')
        if type(manifest.get('schema_version')) is not int or manifest['schema_version'] != 2:
            self.error(manifest_path, 'schema_version must be 2')
        if manifest.get('baseline') != BASELINE:
            self.error(manifest_path, f'baseline must be {BASELINE}')
        sources = manifest.get('sources')
        if not isinstance(sources, list):
            self.error(manifest_path, 'sources must be an array')
            return
        if len(sources) != 47:
            self.error(manifest_path, f'expected 47 retained historical roots, found {len(sources)}')
        registered, ids, totals = set(), set(), Counter()
        for index, source in enumerate(sources):
            label = f'sources[{index}]'
            if not isinstance(source, dict) or set(source) != {'id', 'references', 'documents', 'flagged_documents', 'notes'}:
                self.error(manifest_path, f'{label}: expected exactly id, references, documents, flagged_documents, notes')
                continue
            identity = source['id']
            if not isinstance(identity, str) or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', identity):
                self.error(manifest_path, f'{label}: invalid source id')
                continue
            if identity in ids:
                self.error(manifest_path, f'duplicate source id {identity!r}')
            ids.add(identity)
            valid_counts = all(type(source[key]) is int and source[key] >= 0 for key in ('documents', 'flagged_documents'))
            if not valid_counts or source['documents'] < 1 or source['flagged_documents'] > source['documents']:
                self.error(manifest_path, f'{identity}: invalid document counts')
            else:
                totals['documents'] += source['documents']
                totals['flagged'] += source['flagged_documents']
            if not isinstance(source['notes'], str) or not source['notes'].strip():
                self.error(manifest_path, f'{identity}: notes must be a nonempty string')
            mappings = source['references']
            if not isinstance(mappings, list) or not mappings:
                self.error(manifest_path, f'{identity}: references must be a nonempty array')
                continue
            seen = set()
            for reference in mappings:
                if not isinstance(reference, str) or not re.fullmatch(r'references/[^/]+\.md', reference):
                    self.error(manifest_path, f'{identity}: invalid reference path {reference!r}')
                    continue
                if reference in seen:
                    self.error(manifest_path, f'{identity}: duplicate reference {reference}')
                seen.add(reference)
                path = self.root / reference
                registered.add(path)
                if path not in self.references:
                    self.error(manifest_path, f'{identity}: mapped reference does not exist: {reference}')
                elif path not in self.indexed:
                    self.error(manifest_path, f'{identity}: mapped reference is not indexed: {reference}')
        extensions = manifest.get('extensions')
        if not isinstance(extensions, list) or len(extensions) != 2:
            self.error(manifest_path, 'extensions must describe the two newly authored contracts')
            extensions = []
        extension_ids = set()
        for extension in extensions:
            if not isinstance(extension, dict):
                self.error(manifest_path, 'extension must be an object')
                continue
            identity = extension.get('id')
            if not isinstance(identity, str) or identity in ids or identity in extension_ids:
                self.error(manifest_path, 'extension identity must be unique')
            else:
                extension_ids.add(identity)
            urls = extension.get('primary_urls')
            if not isinstance(urls, list) or not urls or any(
                    not isinstance(url, str) or not url.startswith('https://') for url in urls):
                self.error(manifest_path, 'extension requires primary HTTPS evidence')
            mappings = extension.get('references')
            if not isinstance(mappings, list) or not mappings:
                self.error(manifest_path, 'extension requires reference ownership')
                continue
            for reference in mappings:
                target = self.safe_path(manifest_path, reference, 'extension reference')
                if target not in self.references or target not in self.indexed:
                    self.error(manifest_path, 'extension reference must be packaged and indexed')
                else:
                    registered.add(target)
        if extension_ids != {'openvue', 'application-session-contract'}:
            self.error(manifest_path, 'required local-library and application-session extensions are missing')
        history = manifest.get('history')
        if not isinstance(history, dict) or history.get('commit') != HISTORY_COMMIT:
            self.error(manifest_path, 'history must identify the immutable pre-cutover snapshot')
        for path in sorted(self.references - registered):
            self.error(manifest_path, f'unregistered reference: {self.display(path)}')
        if not isinstance(audit, dict):
            if audit is not None:
                self.error(audit_path, 'audit must be an object')
            return
        history = audit.get('history')
        if not isinstance(history, dict) or history.get('commit') != HISTORY_COMMIT:
            self.error(audit_path, 'history must identify the immutable pre-cutover snapshot')
        counts = audit.get('counts')
        if not isinstance(counts, dict):
            self.error(audit_path, 'counts object is required')
            counts = {}
        for key in ('documents', 'flagged'):
            if type(counts.get(key)) is not int or counts[key] != totals[key]:
                self.error(audit_path, f'counts.{key} must match manifest total {totals[key]}')
        for key in ('truncated', 'errors'):
            if type(counts.get(key)) is not int or counts[key] != 0:
                self.error(audit_path, f'counts.{key} must be 0 for the complete snapshot')
        if 'roots' in counts and counts['roots'] != 47:
            self.error(audit_path, 'counts.roots must be 47')
        if type(audit.get('schema_version')) is not int or audit['schema_version'] != 2:
            self.error(audit_path, 'schema_version must be 2')
        if 'baseline' in audit and audit['baseline'] != BASELINE:
            self.error(audit_path, 'baseline disagrees with manifest')
        roots = audit.get('roots')
        if roots is not None:
            if not isinstance(roots, dict) or set(roots) != ids:
                self.error(audit_path, 'roots must match manifest source IDs')
            else:
                for source in sources:
                    if not isinstance(source, dict) or not isinstance(source.get('id'), str) or source['id'] not in roots:
                        continue
                    root = roots[source['id']]
                    if not isinstance(root, dict) or root.get('documents') != source.get('documents') or root.get('flagged') != source.get('flagged_documents'):
                        self.error(audit_path, f'root counts disagree for {source["id"]}')
        files = audit.get('files')
        if files is None:
            self.error(audit_path, 'files snapshot is required; original source files are not required')
            return
        if not isinstance(files, list):
            self.error(audit_path, 'files must be an array')
            return
        paths, by_root, flagged_roots = set(), Counter(), Counter()
        flagged_count = 0
        for index, item in enumerate(files):
            if not isinstance(item, dict):
                self.error(audit_path, f'files[{index}] must be an object')
                continue
            path = item.get('path')
            if not isinstance(path, str) or not re.fullmatch(r'\.agents/skills/[^/]+/(?!.*(?:^|/)\.\.(?:/|$)).+', path):
                self.error(audit_path, f'files[{index}]: invalid snapshot path')
                continue
            if path in paths:
                self.error(audit_path, f'duplicate snapshot path {path}')
            paths.add(path)
            identity = path.split('/')[2]
            if identity not in ids:
                self.error(audit_path, f'unregistered snapshot source {identity}')
            by_root[identity] += 1
            if not isinstance(item.get('sha256'), str) or not re.fullmatch(r'[0-9a-f]{64}', item['sha256']):
                self.error(audit_path, f'{path}: invalid sha256 snapshot')
            if type(item.get('flagged')) is not bool:
                self.error(audit_path, f'{path}: flagged must be boolean')
            elif item['flagged']:
                flagged_count += 1
                flagged_roots[identity] += 1
            for key in ('domain', 'migration'):
                if not isinstance(item.get(key), str) or not item[key]:
                    self.error(audit_path, f'{path}: {key} must be a nonempty string')
        if len(files) != totals['documents'] or flagged_count != totals['flagged']:
            self.error(audit_path, 'file snapshot document/flagged totals disagree with manifest')
        for source in sources:
            if isinstance(source, dict) and isinstance(source.get('id'), str):
                identity = source['id']
                if by_root[identity] != source.get('documents') or flagged_roots[identity] != source.get('flagged_documents'):
                    self.error(audit_path, f'file snapshot counts disagree for {identity}')

    def cache_reference(self, path, text):
        """Normalize each reference once, retaining canonical heading positions."""
        lines = text.splitlines()
        headings = {index: (title, anchor) for index, title, anchor in
                    markdown_headings(prose_lines(text, lambda message: None))}
        chunks, positions, offset = [], [], 0
        for index, row in enumerate(lines):
            if index in headings:
                positions.append((offset, *headings[index]))
            normalized = ' '.join(row.split())
            if normalized:
                chunks.append(normalized)
                offset += len(normalized) + 1
        self.reference_bodies[path] = (' '.join(chunks), positions)

    def evidence_report(self, relative):
        path = self.root / relative
        report = self.load_json(relative)
        if not isinstance(report, dict):
            self.error(path, 'report must be an object')
            return None
        if type(report.get('schema_version')) is not int or report['schema_version'] != 1:
            self.error(path, 'schema_version must be 1')
        if report.get('baseline') != BASELINE:
            self.error(path, f'baseline must be {BASELINE}')
        if report.get('unresolved') != []:
            self.error(path, 'unresolved must be an empty array')
        return report

    def compare_counts(self, path, label, actual, expected):
        if not isinstance(actual, dict) or set(actual) != set(expected):
            self.error(path, f'{label}: expected exactly {", ".join(sorted(expected))}')
            if not isinstance(actual, dict):
                return
        for key, value in sorted(expected.items()):
            if isinstance(value, dict):
                self.compare_counts(path, f'{label}.{key}', actual.get(key), value)
            elif type(actual.get(key)) is not int or actual[key] != value:
                self.error(path, f'{label}.{key} must be {value}')

    def validate_resolution(self, owner, label, resolution, reference, choices):
        if not isinstance(resolution, dict):
            self.error(owner, f'{label}: resolution must be an object')
            return
        disposition = resolution.get('disposition')
        if not isinstance(disposition, str) or disposition not in choices:
            self.error(owner, f'{label}: invalid resolution disposition')
        for key in ('section', 'anchor', 'evidence', 'explanation'):
            if not isinstance(resolution.get(key), str) or not resolution[key].strip():
                self.error(owner, f'{label}: {key} must be a nonempty string')
        urls = resolution.get('primary_urls')
        if not isinstance(urls, list):
            self.error(owner, f'{label}: primary_urls must be an array')
        else:
            for url in urls:
                try:
                    parsed = urlsplit(url) if isinstance(url, str) else None
                    if parsed is None or parsed.scheme not in ('https', 'http') or not parsed.netloc or any(char.isspace() for char in url):
                        self.error(owner, f'{label}: invalid primary URL {url!r}')
                except ValueError:
                    self.error(owner, f'{label}: invalid primary URL {url!r}')
        target = self.safe_path(owner, reference, f'{label}.reference')
        if target is None:
            return
        if not re.fullmatch(r'references/[^/]+\.md', reference) or target not in self.references:
            self.error(owner, f'{label}: target must be a current packaged reference')
            return
        cached = self.reference_bodies.get(target)
        evidence = resolution.get('evidence')
        if cached is None or not isinstance(evidence, str) or not evidence.strip():
            return
        body, headings = cached
        quote = ' '.join(evidence.split())
        position = body.find(quote)
        if position < 0:
            self.error(owner, f'{label}: evidence quote is stale or absent from {reference}')
            return
        while position >= 0:
            enclosing = next(((title, anchor) for offset, title, anchor in reversed(headings)
                              if offset <= position), None)
            if enclosing == (resolution.get('section'), resolution.get('anchor')):
                return
            position = body.find(quote, position + 1)
        self.error(owner, f'{label}: section/anchor must match the quote’s canonical enclosing heading in {reference}')

    def validate_removals(self):
        self.checks.extend(['explicit removal policy, evidence, and reintroduction requirements',
                            'removed capability boundaries and VitePress-only reference migration'])
        path = self.root / 'assets/removals.json'
        report = self.evidence_report('assets/removals.json')
        if report is not None:
            entries = report.get('removed_integrations')
            if not isinstance(entries, list) or len(entries) != 1 or not isinstance(entries[0], dict):
                self.error(path, 'removed_integrations must contain the one explicit removed integration')
            else:
                entry = entries[0]
                required = {
                    'id': REMOVAL_ID, 'status': 'removed', 'removed_at': '2026-10-21',
                    'packages': REMOVED_PACKAGES, 'source_roots': [REMOVED_ROOT],
                    'source_documents': 9, 'record_reference': REMOVAL_REFERENCE,
                    'record_section': REMOVAL_SECTION, 'record_anchor': REMOVAL_ANCHOR,
                    'exclusion_quote': EXCLUSION_QUOTE,
                    'reference_migration': {'from': OLD_GUIDE, 'to': VITEPRESS_GUIDE},
                    'non_targets': ['vitepress', '@floating-ui/vue'],
                    'reintroduction_requirements': list(REINTRODUCTION_REQUIREMENTS),
                }
                for key, expected in required.items():
                    if entry.get(key) != expected or (key == 'source_documents' and type(entry.get(key)) is not int):
                        self.error(path, f'{REMOVAL_ID}.{key}: must preserve the explicit removal contract')
                reason = entry.get('reason')
                if not isinstance(reason, str) or not reason.strip():
                    self.error(path, 'removal reason must describe the observed integration compatibility defect')
                evidence = entry.get('evidence')
                if not isinstance(evidence, dict):
                    self.error(path, 'removal evidence must be an object')
                    evidence = {}
                observation = evidence.get('runtime_observation')
                if not isinstance(observation, str) or not observation.strip():
                    self.error(path, 'runtime_observation must be a nonempty string describing the observed integration defect')
                beads = evidence.get('beads')
                if (not isinstance(beads, list) or not all(isinstance(item, str) for item in beads)
                        or set(beads) != {'vue-kit-skills-bt3', 'vue-kit-skills-9uu'} or len(beads) != 2):
                    self.error(path, 'evidence.beads must identify both original observation and removal decisions')
                urls = evidence.get('primary_urls')
                expected_urls = {f'https://unpkg.com/{name}@{version}/package.json'
                                 for name, version in REMOVED_PACKAGES.items()}
                if (not isinstance(urls, list) or not all(isinstance(url, str) for url in urls)
                        or len(set(urls)) != len(urls) or not expected_urls.issubset(urls)):
                    self.error(path, 'evidence.primary_urls must include exact metadata for every observed package')
                self.validate_resolution(path, REMOVAL_ID, {
                    'disposition': 'out_of_scope', 'section': entry.get('record_section'),
                    'anchor': entry.get('record_anchor'), 'evidence': entry.get('exclusion_quote'),
                    'explanation': reason, 'primary_urls': urls,
                }, entry.get('record_reference'), {'out_of_scope'})

        old = self.root / OLD_GUIDE
        if old.exists() or old.is_symlink():
            self.error(old, 'removed combined guide must be absent; no compatibility alias is supported')
        guide = self.root / VITEPRESS_GUIDE
        if guide not in self.references or guide not in self.indexed:
            self.error(guide, 'VitePress-only replacement must exist and be directly indexed')
        if len(self.references) != ACTIVE_REFERENCE_COUNT:
            self.error(self.root / 'references',
                       f'the current package must contain exactly {ACTIVE_REFERENCE_COUNT} directly indexed references')
        record_sections = {
            self.root / REMOVAL_REFERENCE: (REMOVAL_SECTION, REMOVAL_ANCHOR, 'Removed integrations'),
            self.root / 'CHANGELOG.md': ('Removed', 'removed', 'Unreleased'),
        }
        for document_path in self.documents:
            try:
                text = document_path.read_text(encoding='utf-8')
                prose = prose_lines(text, lambda message: None)
                record_lines = set()
                record_section = record_sections.get(document_path)
                if record_section is not None:
                    # Only these exact canonical removal subsections can discuss
                    # excluded products; the rest remains active routing.
                    lines = text.splitlines()
                    headings = []
                    for start, title, anchor in markdown_headings(prose):
                        marker = re.match(r'^ {0,3}(#{1,6})\s+', lines[start])
                        level = len(marker[1]) if marker else (1 if lines[start + 1].lstrip().startswith('=') else 2)
                        headings.append((start, title, anchor, level))
                    parent = None
                    for index, (start, title, anchor, level) in enumerate(headings):
                        if level <= 2:
                            parent = title if level == 2 else None
                        if ((title, anchor, parent) == record_section
                                and lines[start].strip() == f'### {record_section[0]}'):
                            end = next((position for position, _, _, depth in headings[index + 1:]
                                        if depth <= 3), len(lines))
                            record_lines.update(range(start + 1, end + 1))
                for number, line in enumerate(text.splitlines(), 1):
                    # Fenced recipes are not removal evidence, including inside
                    # the ledger subsection. prose_lines blanks fenced content.
                    if number in record_lines and prose[number - 1]:
                        continue
                    if REMOVED_TERMS.search(line) or OLD_GUIDE in line or 'docs-slides.md' in line:
                        self.error(document_path, f'line {number}: removed integration must not be advertised or taught')
            except (OSError, UnicodeError) as exc:
                self.error(document_path, f'cannot inspect active removal boundary: {exc}')
        for package_path in self.packaged_paths():
            if package_path.name != 'package.json':
                continue
            package = self.load_json(self.display(package_path))
            if not isinstance(package, dict):
                self.error(package_path, 'packaged package.json must be an object')
                continue
            for group in ('dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'):
                dependencies = package.get(group, {})
                if not isinstance(dependencies, dict):
                    self.error(package_path, f'{group} must be an object')
                    continue
                for name, version in dependencies.items():
                    if REMOVED_TERMS.search(name) or (
                            isinstance(version, str) and version.startswith('npm:')
                            and REMOVED_TERMS.search(version[4:])):
                        self.error(package_path, f'{group}.{name}: removed integration must not be a direct dependency')

        record = self.root / REMOVAL_REFERENCE
        try:
            lines = prose_lines(record.read_text(encoding='utf-8'), lambda message: None)
            parent = None
            found = False
            for line in lines:
                if re.match(r'^##\s+', line):
                    parent = line.strip()
                if line.strip() == f'### {REMOVAL_SECTION}':
                    found = True
                    if parent != '## Removed integrations':
                        self.error(record, 'removal section must be under ## Removed integrations')
            if not found:
                self.error(record, 'exact removal section heading is required')
        except (OSError, UnicodeError) as exc:
            self.error(record, f'cannot inspect removal section: {exc}')
        sources = self.manifest.get('sources', []) if isinstance(self.manifest, dict) else []
        excluded = [source for source in sources if isinstance(source, dict) and source.get('id') == REMOVED_ROOT] if isinstance(sources, list) else []
        if len(excluded) != 1:
            self.error(path, 'manifest must preserve exactly one historical excluded source root')
        else:
            source = excluded[0]
            if source.get('references') != [REMOVAL_REFERENCE] or source.get('documents') != 9:
                self.error(path, 'excluded manifest root must route its nine historical documents only to the removal record')
            notes = source.get('notes')
            if not isinstance(notes, str) or not re.search(r'exclu(?:ded|sion)', notes, re.I):
                self.error(path, 'excluded manifest root notes must explicitly identify exclusion')

    def native_choice(self, native, key):
        if not isinstance(native, dict) or not isinstance(native.get(key), dict):
            return None
        choice = native[key].get('choice')
        return choice if isinstance(choice, str) else None

    def validate_native_fingerprint(self, path, label, records):
        try:
            encoded = json.dumps(records, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
            fingerprint = hashlib.sha256(encoded.encode('utf-8')).hexdigest()
        except (ValueError, UnicodeError, RecursionError) as exc:
            self.error(path, f'{label}: cannot fingerprint native verdicts: {exc}')
            return
        if fingerprint != NATIVE_FINGERPRINTS[label]:
            self.error(path, f'{label}: native verdicts differ from the frozen accepted hypotheses')

    def validate_coverage(self):
        self.checks.extend(['retained historical source identities, native hypotheses and current routing',
                            'historical reference population plus separately indexed reviewed extensions'])
        path = self.root / 'assets/coverage-audit.json'
        report = self.load_json('assets/coverage-audit.json')
        if not isinstance(report, dict):
            self.error(path, 'coverage report must be an object')
            return
        if report.get('schema_version') != 2 or report.get('baseline') != BASELINE:
            self.error(path, 'coverage schema/baseline disagree with current provenance')
        if report.get('unresolved') != [] or not isinstance(report.get('method'), str) or not report['method'].strip():
            self.error(path, 'coverage method and empty unresolved list are required')
        history = report.get('history')
        if not isinstance(history, dict) or history.get('commit') != HISTORY_COMMIT:
            self.error(path, 'history must identify the immutable pre-cutover snapshot')
        manifest_sources = self.manifest.get('sources', []) if isinstance(self.manifest, dict) else []
        if not isinstance(manifest_sources, list):
            manifest_sources = []
        roots = {row['id']: row for row in manifest_sources
                 if isinstance(row, dict) and isinstance(row.get('id'), str)}
        audit_files = self.audit.get('files', []) if isinstance(self.audit, dict) else []
        if not isinstance(audit_files, list):
            audit_files = []
        originals = {row['path']: row for row in audit_files
                     if isinstance(row, dict) and isinstance(row.get('path'), str)}
        sources = report.get('sources')
        if not isinstance(sources, list):
            self.error(path, 'sources must be an array')
            sources = []
        seen, native_sources, choices = set(), {}, Counter()
        for index, row in enumerate(sources):
            if not isinstance(row, dict):
                self.error(path, f'sources[{index}] must be an object')
                continue
            source = row.get('source')
            if not isinstance(source, str) or source not in originals or source in seen:
                self.error(path, f'sources[{index}] must identify one unique retained source')
                continue
            seen.add(source)
            identity = source.split('/')[2]
            if row.get('source_root') != identity or identity not in roots:
                self.error(path, f'{source}: source root disagrees with provenance')
            if row.get('sha256') != originals[source].get('sha256'):
                self.error(path, f'{source}: original source hash changed')
            if row.get('mapped_references') != roots.get(identity, {}).get('references'):
                self.error(path, f'{source}: routing must match its manifest owner')
            expected_status = 'excluded' if identity == REMOVED_ROOT else 'historical-routing'
            if row.get('status') != expected_status:
                self.error(path, f'{source}: routing is historical, not fresh semantic acceptance')
            if row.get('historical_disposition') not in ('covered', 'corrected', 'out_of_scope'):
                self.error(path, f'{source}: invalid preserved disposition')
            native_sources[source] = {'sha256': row.get('sha256'), 'native': row.get('native')}
            choice = self.native_choice(row.get('native'), 'coverage')
            if choice is not None:
                choices[choice] += 1
        if seen != set(originals) or len(sources) != 459:
            self.error(path, 'coverage must route all 459 retained historical source units exactly once')
        self.validate_native_fingerprint(path, 'sources', native_sources)
        self.compare_counts(path, 'native_source_choices', dict(choices), NATIVE_COUNTS['native_source_choices'])
        references = report.get('references')
        if not isinstance(references, list):
            self.error(path, 'references must be an array')
            references = []
        native_references, reference_paths = {}, set()
        for row in references:
            if not isinstance(row, dict):
                self.error(path, 'historical reference must be an object')
                continue
            reference = row.get('path')
            if not isinstance(reference, str) or reference in reference_paths:
                self.error(path, 'historical reference paths must be unique strings')
                continue
            reference_paths.add(reference)
            native_path = row.get('native_path', reference)
            if reference == VITEPRESS_GUIDE:
                if native_path != OLD_GUIDE:
                    self.error(path, 'documentation migration must preserve historical identity')
            elif native_path != reference:
                self.error(path, 'unexpected historical reference alias')
            if not isinstance(native_path, str) or native_path in native_references:
                self.error(path, 'historical reference identity must be unique')
                continue
            native_references[native_path] = row.get('native')
        self.validate_native_fingerprint(path, 'references', native_references)
        extensions = report.get('extensions')
        if extensions != list(CURRENT_REFERENCE_EXTENSIONS):
            self.error(path, 'reviewed extension paths must match the current explicit inventory')
        active = {self.display(reference) for reference in self.references}
        if reference_paths | set(CURRENT_REFERENCE_EXTENSIONS) != active or len(references) != 38:
            self.error(path, 'historical references and reviewed extensions must cover the complete active index')
        self.compare_counts(path, 'counts', report.get('counts'), {
            'sources': 459, 'roots': 47, 'historical_references': 38, 'active_references': ACTIVE_REFERENCE_COUNT,
        })

    def validate_openvue_coverage(self):
        self.checks.append('complete OpenVue documentation routing and retained native hypotheses (not runtime certification)')
        path = self.root / 'assets/openvue-coverage.json'
        report = self.load_json('assets/openvue-coverage.json')
        if not isinstance(report, dict):
            self.error(path, 'OpenVue coverage must be an object')
            return
        if (report.get('schema_version') != 1 or report.get('baseline') != BASELINE
                or report.get('openvue') != '1.0.0'
                or report.get('source_commit') != 'd064f02ac75c3aaeb60a676c70e5ee08e3e3042e'):
            self.error(path, 'OpenVue coverage schema, baseline or source release disagree')
        if report.get('unresolved') != [] or not isinstance(report.get('method'), str):
            self.error(path, 'OpenVue coverage requires its method and empty unresolved list')
        if (report.get('input_cap') != 26000 or not isinstance(report.get('rubric'), dict)
                or not isinstance(report.get('escalation'), str)):
            self.error(path, 'OpenVue coverage requires the frozen rubric, cap and escalation policy')
        self.compare_counts(path, 'counts', report.get('counts'), {
            'documents': 122, 'pages': 27, 'components': 95, 'truncated': 21, 'escalated': 80,
        })
        if report.get('native_fingerprint') != NATIVE_FINGERPRINTS['openvue-documents']:
            self.error(path, 'OpenVue native fingerprint metadata disagrees with the frozen population')
        rows = report.get('documents')
        if not isinstance(rows, list):
            self.error(path, 'OpenVue documents must be an array')
            return
        owners = set(CURRENT_REFERENCE_EXTENSIONS[2:])
        active = {self.display(reference) for reference in self.references}
        native, kinds, represented = {}, Counter(), set()
        source_metadata, dispositions, references = {}, Counter(), Counter()
        for row in rows:
            if not isinstance(row, dict):
                self.error(path, 'OpenVue document must be an object')
                continue
            identity = row.get('id')
            if not isinstance(identity, str) or not identity or identity in native:
                self.error(path, 'OpenVue document identities must be unique nonempty strings')
                continue
            digest = row.get('sha256')
            if not isinstance(digest, str) or not re.fullmatch(r'[0-9a-f]{64}', digest):
                self.error(path, f'{identity}: source SHA-256 is required')
            native[identity] = {'sha256': digest, 'native': row.get('native')}
            source_metadata[identity] = {key: row.get(key) for key in OPENVUE_SOURCE_FIELDS}
            for key in ('owner', 'risk'):
                verdict = row.get('native', {}).get(key) if isinstance(row.get('native'), dict) else None
                if (not isinstance(verdict, dict) or not isinstance(verdict.get('choice'), str)
                        or not isinstance(verdict.get('probabilities'), dict)):
                    self.error(path, f'{identity}: complete native {key} verdict is required')
            kind = row.get('source_kind')
            if kind not in ('pages', 'components'):
                self.error(path, f'{identity}: invalid source kind')
            else:
                kinds[kind] += 1
            owner = row.get('final_reference')
            if not isinstance(owner, str) or owner not in owners or owner not in active:
                self.error(path, f'{identity}: final owner must be an indexed OpenVue reference')
            else:
                represented.add(owner)
                references[owner] += 1
            if row.get('disposition') not in ('documented', 'context_only', 'excluded'):
                self.error(path, f'{identity}: invalid final disposition')
            else:
                dispositions[row['disposition']] += 1
            if not isinstance(row.get('reason'), str) or not row['reason'].strip():
                self.error(path, f'{identity}: evidence-backed disposition reason is required')
            urls = row.get('primary_urls')
            if (not isinstance(urls, list) or not urls
                    or any(not isinstance(url, str) or not url.startswith('https://') for url in urls)):
                self.error(path, f'{identity}: primary HTTPS evidence is required')
        if len(rows) != 122 or len(native) != 122 or dict(kinds) != {'pages': 27, 'components': 95}:
            self.error(path, 'OpenVue coverage must route all27 guide and95 component pages exactly once')
        if represented != owners:
            self.error(path, 'all eight OpenVue capability owners must be represented')
        for label, expected in (('truncated', 21), ('escalated', 80)):
            identities = report.get(label)
            if (not isinstance(identities, list) or len(identities) != expected
                    or any(not isinstance(identity, str) or identity not in native for identity in identities)
                    or len(set(identities)) != expected):
                self.error(path, f'OpenVue {label} inputs must retain their complete unique identities')
        self.validate_native_fingerprint(path, 'openvue-documents', native)
        self.compare_counts(path, 'disposition_counts', report.get('disposition_counts'), dict(dispositions))
        self.compare_counts(path, 'reference_counts', report.get('reference_counts'), dict(references))
        inputs = {key: report.get(key) for key in OPENVUE_INPUT_FIELDS}
        inputs['sources'] = source_metadata
        try:
            encoded = json.dumps(inputs, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
            fingerprint = hashlib.sha256(encoded.encode('utf-8')).hexdigest()
        except (ValueError, UnicodeError, RecursionError) as exc:
            self.error(path, f'cannot fingerprint frozen OpenVue discovery inputs: {exc}')
        else:
            if fingerprint != OPENVUE_INPUT_FINGERPRINT:
                self.error(path, 'frozen OpenVue discovery inputs differ from the accepted snapshot')

    def validate_service_independence(self):
        self.checks.append('service-independent capability boundary and supported UI successor')
        forbidden = re.compile(r'\u0063lerk|\u0070rime(?:vue|ui|uix)', re.I)
        attribution = 'OpenVue 1.0.0, a fork of \u0050rimeVue 4.5.5'
        attribution_count = 0
        for path in self.packaged_paths():
            try:
                text = path.read_text(encoding='utf-8')
            except UnicodeError:
                continue
            except OSError as exc:
                self.error(path, f'cannot inspect service boundary: {exc}')
                continue
            attribution_count += text.count(attribution)
            remaining = text.replace(attribution, '')
            if forbidden.search(remaining):
                self.error(path, 'excluded vendor material remains outside the permitted successor attribution')
        if attribution_count != 1:
            self.error(self.root / 'references/openvue.md',
                       'exactly one supported-successor fork attribution is required')

    def validate_verification(self, refresh_footprint=False):
        self.checks.extend(['scoped recorded verification metadata',
                            'complete content-addressed packaged file footprint (not runtime certification)'])
        relative = 'assets/verification.json'
        path = self.root / relative
        report = self.evidence_report(relative)
        if report is None:
            return
        self.verification = report
        recorded = report.get('recorded_at')
        try:
            timestamp = datetime.fromisoformat(recorded[:-1] + '+00:00' if isinstance(recorded, str) and recorded.endswith('Z') else recorded)
            if timestamp.tzinfo is None or timestamp.utcoffset().total_seconds() != 0:
                raise ValueError('not UTC')
        except (TypeError, ValueError, OverflowError):
            self.error(path, 'recorded_at must be a UTC ISO timestamp')
        if not isinstance(report.get('environment'), dict):
            self.error(path, 'environment must be an object')
        limits = report.get('limits')
        if not isinstance(limits, list) or not limits or any(not isinstance(item, str) or not item.strip() for item in limits):
            self.error(path, 'limits must be a nonempty array of nonempty strings')
        checks = report.get('checks')
        if not isinstance(checks, list) or not checks:
            self.error(path, 'checks must be a nonempty array')
            checks = []
        identities = set()
        for index, check in enumerate(checks):
            label = f'checks[{index}]'
            if not isinstance(check, dict):
                self.error(path, f'{label}: check must be an object')
                continue
            identity = check.get('id')
            if not isinstance(identity, str) or not identity.strip():
                self.error(path, f'{label}: id must be a nonempty string')
            elif identity in identities:
                self.error(path, f'{label}: duplicate check id {identity!r}')
            else:
                identities.add(identity)
            if not isinstance(check.get('scope'), str) or not check['scope'].strip():
                self.error(path, f'{label}: scope must be a nonempty string')
            if check.get('result') not in ('passed', 'observed', 'expected_failure'):
                self.error(path, f'{label}: result must be passed, observed, or expected_failure')
            details = check.get('details')
            if not isinstance(details, dict) and not (isinstance(details, str) and details.strip()):
                self.error(path, f'{label}: details must be an object or nonempty string')
            if 'command' in check and (not isinstance(check['command'], str) or not check['command'].strip()):
                self.error(path, f'{label}: command must be a nonempty string when provided')
        snapshots = report.get('snapshots')
        if not isinstance(snapshots, dict):
            self.error(path, 'snapshots must be an object')
            return
        if snapshots.get('algorithm') != 'sha256':
            self.error(path, 'snapshots.algorithm must be sha256')
        files = snapshots.get('files')
        if not isinstance(files, dict):
            self.error(path, 'snapshots.files must map packaged paths to SHA256 hashes')
            return
        current = {self.display(item): item for item in self.packaged_paths() if self.display(item) != relative}
        if refresh_footprint:
            self.checks.append('explicit footprint refresh only; no recorded checks or timestamps renewed')
        for name, digest in sorted(files.items()):
            target = self.safe_path(path, name, 'snapshots.files key')
            if target is None:
                continue
            if name == relative:
                self.error(path, 'verification report must not snapshot itself')
            if any(part in IGNORED for part in Path(name).parts[:-1]):
                self.error(path, f'snapshot contains an ignored directory: {name}')
            if not isinstance(digest, str) or not re.fullmatch(r'[0-9a-f]{64}', digest):
                self.error(path, f'invalid snapshot SHA256: {name}')
                continue
        for name, target in sorted(current.items()):
            try:
                hasher = hashlib.sha256()
                with target.open('rb') as stream:
                    for chunk in iter(lambda: stream.read(65536), b''):
                        hasher.update(chunk)
                digest = hasher.hexdigest()
                self.current_footprint[name] = digest
                if not refresh_footprint and name in files and digest != files[name]:
                    self.error(path, f'stale packaged snapshot: {name}')
            except OSError as exc:
                self.error(path, f'cannot hash {name}: {exc}')
        if not refresh_footprint:
            for name in sorted(set(current) - set(files)):
                self.error(path, f'missing packaged snapshot: {name}')
            for name in sorted(set(files) - set(current)):
                self.error(path, f'extra packaged snapshot: {name}')

    def refresh_footprint(self):
        """Atomically replace only the current file map, never execution metadata."""
        path = self.root / 'assets/verification.json'
        report = self.verification
        report['snapshots']['files'] = self.current_footprint
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent,
                                             prefix='.verification-', suffix='.tmp', delete=False) as stream:
                temporary = Path(stream.name)
                stream.write(json.dumps(report, indent=2, ensure_ascii=True) + '\n')
            os.chmod(temporary, path.stat().st_mode & 0o777)
            os.replace(temporary, path)
            return True
        except (OSError, ValueError, UnicodeError) as exc:
            self.error(path, f'cannot refresh packaged footprint: {exc}')
            return False
        finally:
            if temporary is not None:
                try:
                    temporary.unlink(missing_ok=True)
                except OSError as exc:
                    self.error(path, f'cannot remove refresh temporary file: {exc}')

    def validate_current_audit(self):
        relative = 'assets/current-audit.json'
        path = self.root / relative
        if not path.exists() and not path.is_symlink():
            return
        self.checks.append('optional current audit inventory and evidence schema (not authenticity or runtime certification)')
        report = self.load_json(relative)
        if not isinstance(report, dict):
            self.error(path, 'current audit must be a JSON object')
            return

        def nonempty(value):
            return isinstance(value, str) and bool(value.strip())

        def strings(value, label, allow_empty=False):
            if (not isinstance(value, list) or (not value and not allow_empty)
                    or any(not nonempty(item) for item in value)):
                self.error(path, f'{label}: expected an array of nonempty strings')
                return []
            if len(value) != len(set(value)):
                self.error(path, f'{label}: entries must be unique')
            return value

        if type(report.get('schema_version')) is not int or report['schema_version'] != 1:
            self.error(path, 'current audit schema_version must be 1')
        recorded = report.get('recorded_at')
        try:
            if not nonempty(recorded):
                raise ValueError('missing timestamp')
            datetime.fromisoformat(recorded[:-1] + '+00:00' if recorded.endswith('Z') else recorded)
        except (ValueError, OverflowError):
            self.error(path, 'current audit recorded_at must be an ISO timestamp')
        if not nonempty(report.get('scope')):
            self.error(path, 'current audit scope must be nonempty')
        if not isinstance(report.get('rubric'), dict) or not report['rubric']:
            self.error(path, 'current audit rubric must be a nonempty object')
        strings(report.get('historical_limits'), 'historical_limits')
        inventory = report.get('inventory')
        if not isinstance(inventory, dict):
            self.error(path, 'current audit inventory must be an object')
            inventory = {}
        count_fields = ('authored_files', 'audit_units', 'escalated_units', 'unflagged_units',
                        'judge_errors', 'truncated_units')
        for key in count_fields:
            if type(inventory.get(key)) is not int or inventory[key] < 0:
                self.error(path, f'inventory.{key}: expected a nonnegative integer')
        for key in ('dispositions', 'prefilter_exclusions'):
            counts = inventory.get(key)
            if (not isinstance(counts, dict)
                    or any(not nonempty(name) or type(value) is not int or value < 0
                           for name, value in counts.items())):
                self.error(path, f'inventory.{key}: expected nonnegative integer counts')
        if all(type(inventory.get(key)) is int for key in count_fields):
            if inventory['audit_units'] != inventory['escalated_units'] + inventory['unflagged_units']:
                self.error(path, 'inventory escalated and unflagged totals must partition audit_units')
            if inventory['judge_errors'] != 0 or inventory['truncated_units'] > inventory['audit_units']:
                self.error(path, 'current audit requires no judge errors and bounded truncation')
            counts = inventory.get('dispositions')
            if isinstance(counts, dict) and all(type(value) is int for value in counts.values()):
                if sum(counts.values()) != inventory['audit_units']:
                    self.error(path, 'inventory dispositions must total audit_units')

        files = report.get('files')
        if not isinstance(files, list):
            self.error(path, 'current audit files must be an array')
            files = []
        expected = {self.display(item) for item in self.packaged_paths() if self.display(item) != relative}
        seen, units, reviewed = set(), set(), set()
        evidence_types = {'official_docs', 'package_source', 'repository_source',
                          'historical_invariant', 'manual_gpu_pending', 'navigation'}
        for index, row in enumerate(files):
            label = f'files[{index}]'
            if not isinstance(row, dict):
                self.error(path, f'{label}: expected a file record')
                continue
            name = row.get('path')
            target = self.safe_path(path, name, f'{label}.path')
            if target is None:
                continue
            if name not in expected or name in seen:
                self.error(path, f'{label}: file must be packaged, non-self and unique')
            seen.add(name)
            owned = strings(row.get('unit_ids'), f'{label}.unit_ids')
            selected = strings(row.get('reviewed_unit_ids'), f'{label}.reviewed_unit_ids', allow_empty=True)
            prefix = f'skills/vue-kit/{name}'
            if any(unit != prefix and not unit.startswith((prefix + ':', prefix + '#')) for unit in owned):
                self.error(path, f'{label}: unit IDs must retain their owning file prefix')
            if units.intersection(owned) or not set(selected).issubset(owned):
                self.error(path, f'{label}: units must be globally unique and reviewed IDs must be owned')
            units.update(owned)
            reviewed.update(selected)
            claims = row.get('claim_evidence')
            if not isinstance(claims, list):
                self.error(path, f'{label}.claim_evidence: expected an array')
                claims = []
            evidenced = set()
            for claim_index, claim in enumerate(claims):
                claim_label = f'{label}.claim_evidence[{claim_index}]'
                if not isinstance(claim, dict):
                    self.error(path, f'{claim_label}: expected an evidence record')
                    continue
                claim_units = strings(claim.get('unit_ids'), f'{claim_label}.unit_ids')
                if not set(claim_units).issubset(selected):
                    self.error(path, f'{claim_label}: evidence must identify reviewed units in this file')
                evidenced.update(claim_units)
                kind = claim.get('evidence_type')
                if not isinstance(kind, str) or kind not in evidence_types:
                    self.error(path, f'{claim_label}: invalid evidence_type')
                for key in ('claim', 'source_url_or_pointer', 'version_scope', 'disposition'):
                    if not nonempty(claim.get(key)):
                        self.error(path, f'{claim_label}.{key}: expected a nonempty string')
            if evidenced != set(selected):
                self.error(path, f'{label}: every reviewed unit requires evidence')
        if seen != expected or len(files) != len(expected):
            self.error(path, 'current audit must inventory every non-self packaged file exactly once')
        for key, actual in (('authored_files', len(files)), ('audit_units', len(units)),
                            ('escalated_units', len(reviewed))):
            if inventory.get(key) != actual:
                self.error(path, f'inventory.{key}: must match file/unit records')

        extension = report.get('source_extension')
        extension_units = {unit for unit in units if '#workbench-graphics/' in unit}
        if extension is None and extension_units:
            self.error(path, 'workbench source units require their explicit source_extension')
        if extension is not None:
            if not isinstance(extension, dict):
                self.error(path, 'source_extension must be an object')
                extension = {}
            if extension.get('id') != 'workbench-graphics':
                self.error(path, 'source_extension must identify the workbench-graphics source review')
            for key in ('scope', 'reviewer', 'method'):
                if not nonempty(extension.get(key)):
                    self.error(path, f'source_extension.{key}: expected a nonempty string')
            timestamp = extension.get('reviewed_at')
            try:
                if not nonempty(timestamp):
                    raise ValueError('missing timestamp')
                datetime.fromisoformat(timestamp[:-1] + '+00:00' if timestamp.endswith('Z') else timestamp)
            except (ValueError, OverflowError):
                self.error(path, 'source_extension.reviewed_at must be an ISO timestamp')
            strings(extension.get('limits'), 'source_extension.limits')
            added = set(strings(extension.get('unit_ids'), 'source_extension.unit_ids'))
            new_files = set(strings(extension.get('new_files'), 'source_extension.new_files'))
            if added != extension_units or not added.issubset(reviewed):
                self.error(path, 'source extension units must be namespaced and fully source-reviewed')
            population, actual_new_files = {}, set()
            for row in files:
                if (not isinstance(row, dict) or not isinstance(row.get('path'), str)
                        or not isinstance(row.get('unit_ids'), list)):
                    continue
                owned = [unit for unit in row['unit_ids'] if isinstance(unit, str)]
                original = [unit for unit in owned if unit not in added]
                if original:
                    population[row.get('path')] = original
                elif owned:
                    actual_new_files.add(row.get('path'))
                source_lines = None
                if any(unit in added for unit in owned):
                    source = self.safe_path(path, row['path'], 'extension source')
                    if source is not None:
                        try:
                            source_lines = source.read_text(encoding='utf-8').splitlines()
                        except (OSError, UnicodeError) as exc:
                            self.error(path, f'cannot inspect extension source: {exc}')
                claims = row.get('claim_evidence', [])
                for claim in claims if isinstance(claims, list) else []:
                    if not isinstance(claim, dict) or not isinstance(claim.get('unit_ids'), list):
                        continue
                    claim_units = {unit for unit in claim['unit_ids'] if isinstance(unit, str)}
                    if claim_units.intersection(added) and (
                            not claim_units.issubset(added)
                            or claim.get('disposition') != 'source-reviewed'
                            or claim.get('evidence_type') not in ('repository_source', 'package_source', 'official_docs')):
                        self.error(path, 'extension evidence must be source-only and separate from original units')
                    if claim_units.intersection(added):
                        excerpts = claim.get('source_excerpts')
                        if not isinstance(excerpts, list) or not excerpts:
                            self.error(path, 'extension evidence requires current literal source excerpts')
                            continue
                        for excerpt in excerpts:
                            if (not isinstance(excerpt, dict)
                                    or type(excerpt.get('line')) is not int
                                    or source_lines is None
                                    or not 1 <= excerpt['line'] <= len(source_lines)
                                    or excerpt.get('text') != source_lines[excerpt['line'] - 1]):
                                self.error(path, 'extension excerpt must match its current file and line')
            if actual_new_files != new_files:
                self.error(path, 'source extension new_files must identify exactly the newly inventoried files')
            original_inventory = extension.get('original_inventory')
            frozen = {'inventory': original_inventory, 'files': population}
            digest = hashlib.sha256(json.dumps(
                frozen, ensure_ascii=True, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
            if digest != CURRENT_AUDIT_ORIGINAL_POPULATION:
                self.error(path, 'source extension must preserve the original inventory and file/unit identities')
            if isinstance(original_inventory, dict):
                current = dict(original_inventory)
                for key, extra in (('authored_files', len(new_files)), ('audit_units', len(added)),
                                   ('escalated_units', len(added))):
                    value = current.get(key)
                    if type(value) is int:
                        current[key] = value + extra
                dispositions = dict(current.get('dispositions', {})) if isinstance(current.get('dispositions'), dict) else {}
                dispositions['source_reviewed_extension'] = len(added)
                current['dispositions'] = dispositions
                if inventory != current:
                    self.error(path, 'current inventory must add only the separately source-reviewed extension population')

        executions = report.get('executions')
        if not isinstance(executions, list):
            self.error(path, 'current audit executions must be an array')
            executions = []
        execution_ids = set()
        for index, execution in enumerate(executions):
            label = f'executions[{index}]'
            if not isinstance(execution, dict):
                self.error(path, f'{label}: expected an execution record')
                continue
            identity = execution.get('id')
            if not nonempty(identity) or identity in execution_ids:
                self.error(path, f'{label}: execution id must be unique and nonempty')
            else:
                execution_ids.add(identity)
            for key in ('command', 'scope'):
                if not nonempty(execution.get(key)):
                    self.error(path, f'{label}.{key}: expected a nonempty string')
            if execution.get('outcome') not in ('passed', 'failed'):
                self.error(path, f'{label}: only observed passed/failed outcomes may be recorded')
            observations = execution.get('observations')
            if not (nonempty(observations) or isinstance(observations, (dict, list)) and observations):
                self.error(path, f'{label}: nonempty observations are required')
        gpu = report.get('manual_gpu_confirmation')
        if not isinstance(gpu, dict):
            self.error(path, 'manual_gpu_confirmation must be an object')
        else:
            status = gpu.get('status')
            if status not in ('pending_user', 'reviewed_with_limits'):
                self.error(path, 'manual GPU confirmation must be pending_user or a scoped reviewed_with_limits receipt')
            if gpu.get('bead_id') != 'vue-kit-skills-liu.27':
                self.error(path, 'manual GPU confirmation must identify the final human gate')
            for key in ('scope', 'limits'):
                if not nonempty(gpu.get(key)):
                    self.error(path, f'manual_gpu_confirmation.{key}: expected a nonempty string')
            if status == 'reviewed_with_limits':
                followup = gpu.get('followup')
                if not isinstance(followup, dict):
                    self.error(path, 'reviewed baseline evidence requires its corrected-source target-device gate')
                    followup = {}
                if (followup.get('status') not in ('pending_user', 'reviewed_with_limits')
                        or followup.get('bead_id') != 'vue-kit-skills-liu.33.3'
                        or not nonempty(followup.get('scope'))):
                    self.error(path, 'corrected-source GPU evidence requires a scoped pending or reviewed gate')
                receipts = [('reviewed_report', gpu.get('reviewed_report'))]
                if followup.get('status') == 'reviewed_with_limits':
                    receipts.append(('followup.reviewed_report', followup.get('reviewed_report')))
                for label, receipt in receipts:
                    if not isinstance(receipt, dict):
                        self.error(path, f'{label}: reviewed GPU evidence requires its report receipt')
                        receipt = {}
                    for key in ('filename', 'exported_at'):
                        if not nonempty(receipt.get(key)):
                            self.error(path, f'manual_gpu_confirmation.{label}.{key}: expected a nonempty string')
                    digest = receipt.get('sha256')
                    if not isinstance(digest, str) or not re.fullmatch(r'[0-9a-f]{64}', digest):
                        self.error(path, f'{label}: reviewed GPU report requires an exact SHA-256 identity')
                    if type(receipt.get('bytes')) is not int or receipt['bytes'] <= 0:
                        self.error(path, f'{label}: reviewed GPU report requires a positive byte count')
                    strings(receipt.get('observations'), f'manual_gpu_confirmation.{label}.observations')

    def validate_package(self):
        self.checks.append('example package pinned dependencies, script declarations and Bun lockfile presence (not resolution)')
        path = self.root / 'assets/example-app/package.json'
        package = self.load_json('assets/example-app/package.json')
        if not isinstance(package, dict):
            if package is not None:
                self.error(path, 'package must be an object')
            return
        if package.get('packageManager') != 'bun@1.4.3':
            self.error(path, 'packageManager must be bun@1.4.3')
        lockfile = path.parent / 'bun.lock'
        try:
            if not lockfile.is_file() or not lockfile.read_text(encoding='utf-8').strip():
                self.error(lockfile, 'authoritative Bun lockfile must be a nonempty file')
        except (OSError, UnicodeError) as exc:
            self.error(lockfile, f'cannot read authoritative Bun lockfile: {exc}')
        for name in ('package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb'):
            obsolete = path.parent / name
            if obsolete.exists():
                self.error(obsolete, 'example must have only one authoritative lockfile: bun.lock')
        for group in ('dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'):
            values = package.get(group, {})
            if not isinstance(values, dict):
                self.error(path, f'{group} must be an object')
                continue
            for name, version in sorted(values.items()):
                if not isinstance(version, str) or not SEMVER.fullmatch(version):
                    self.error(path, f'{group}.{name} must use an exact pinned version')
        dependencies = package.get('dependencies', {})
        development = package.get('devDependencies', {})
        if not isinstance(dependencies, dict) or not isinstance(development, dict):
            return
        required = {
            'dependencies': {
                **BASELINE, 'pinia': '3.0.4', 'vue-router': '4.6.4',
                '@tresjs/core': '5.9.3', 'three': '0.186.1',
            },
            'devDependencies': {
                '@vitejs/plugin-vue': '6.0.10', 'vite': '8.3.4',
                'typescript': '5.9.3', 'vue-tsc': '3.3.13',
                '@types/node': '24.19.2', '@types/three': '0.186.0',
            },
        }
        for group, versions in required.items():
            for name, version in versions.items():
                if package.get(group, {}).get(name) != version:
                    self.error(path, f'{group}.{name} must be {version}')
        if package.get('private') is not True or package.get('type') != 'module':
            self.error(path, 'example package must be private and use type=module')
        scripts = package.get('scripts')
        if not isinstance(scripts, dict):
            self.error(path, 'scripts must be an object')
            return
        expected = {'dev': 'vite', 'build': 'vite build', 'typecheck': 'vue-tsc --noEmit'}
        for name, command in expected.items():
            if scripts.get(name) != command:
                self.error(path, f'scripts.{name} must be {command!r}')

    def run(self, refresh_footprint=False):
        refreshed = False
        if not self.root.is_dir():
            self.error(self.root, 'skill root is not a directory')
        else:
            self.validate_documents()
            self.validate_provenance()
            self.validate_removals()
            self.validate_package()
            self.validate_coverage()
            self.validate_openvue_coverage()
            self.validate_service_independence()
            self.validate_current_audit()
            self.validate_verification(refresh_footprint)
            if refresh_footprint and not self.errors:
                refreshed = self.refresh_footprint()
        result = {'valid': not self.errors, 'checks': self.checks, 'errors': sorted(set(self.errors))}
        if refresh_footprint:
            result['footprint_refreshed'] = refreshed
        return result


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('root', nargs='?', type=Path, default=Path(__file__).resolve().parent.parent, help='skill directory (default: script parent.parent)')
    parser.add_argument('--json', action='store_true', help='emit deterministic JSON instead of human-readable diagnostics')
    parser.add_argument('--refresh-footprint', action='store_true',
                        help='replace only snapshots.files if structural and metadata checks pass; no runtime evidence is renewed')
    args = parser.parse_args()
    result = Validator(args.root).run(refresh_footprint=args.refresh_footprint)
    if args.json:
        print(json.dumps(result, indent=2, sort_keys=True, ensure_ascii=False))
    else:
        for check in result['checks']:
            print(f'CHECK: {check}')
        for error in result['errors']:
            print(f'ERROR: {error}')
        print(f'Validation {"passed" if result["valid"] else "failed"}: {len(result["checks"])} checks, {len(result["errors"])} errors. No runtime tests executed.')
    return 0 if result['valid'] else 1


if __name__ == '__main__':
    sys.exit(main())
