#!/usr/bin/env python3
"""Validate an installed Vue Kit skill using Python 3.9+ and its standard library.

Usage: python3 scripts/validate.py [ROOT] [--json]

The frontmatter reader deliberately supports a small YAML subset: top-level
string fields, a two-space-indented metadata string map, quoted/plain scalars,
and literal/folded block strings (|, |-, |+, >, >-, >+). Folded blocks accept
one plain paragraph; other YAML constructs are rejected, never evaluated.
This checks packaged structure and provenance consistency, not example runtime
behavior, upstream truth, or the availability of original source documents.
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
from urllib.parse import unquote, urlsplit


BASELINE = {"vue": "3.5.44", "vuetify": "4.3.0"}
IGNORED = {".git", "node_modules", "dist", ".vite", "__pycache__", ".venv"}
SEMVER = re.compile(r"\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?\Z")
# Fingerprints preserve the accepted native hypotheses, including probabilities,
# independently of the later primary-evidence resolutions.
# These are historical-integrity checks, not proof of audit or runtime execution.
NATIVE_FINGERPRINTS = {
    'sources': '47921a384b9779b90329063e8107eb35a404aa09598e731137ebd726a0bebfa9',
    'references': '4e81026e20777414d4a0c2871fa207c79d1668ed3f3f5b9e1bc65867184355c2',
}
NATIVE_COUNTS = {
    'native_source_choices': {'covered': 338, 'partial': 127, 'missing': 1, 'out_of_scope': 1},
    'native_reference_readiness': {'ready': 37, 'mixed': 1},
}

# Current additions are reviewed separately from the immutable 38-reference
# native population. Declaring a new file here requires its own extension review.
CURRENT_REFERENCE_EXTENSIONS = (
    'references/nuxt.md',
    'references/nuxt-integrations.md',
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
    if re.fullmatch(r"(?i:null|true|false|yes|no|on|off|~|[-+]?(?:\d[\d_.eE+-]*|\.inf|\.nan))", value):
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
    """Keep line numbers while excluding fenced code (CommonMark fence rules)."""
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
        if set(manifest) != {'schema_version', 'baseline', 'sources'}:
            self.error(manifest_path, 'expected exactly schema_version, baseline, sources')
        if type(manifest.get('schema_version')) is not int or manifest['schema_version'] != 1:
            self.error(manifest_path, 'schema_version must be 1')
        if manifest.get('baseline') != BASELINE:
            self.error(manifest_path, f'baseline must be {BASELINE}')
        sources = manifest.get('sources')
        if not isinstance(sources, list):
            self.error(manifest_path, 'sources must be an array')
            return
        if len(sources) != 49:
            self.error(manifest_path, f'expected 49 sources, found {len(sources)}')
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
        for path in sorted(self.references - registered):
            self.error(manifest_path, f'unregistered reference: {self.display(path)}')
        if not isinstance(audit, dict):
            if audit is not None:
                self.error(audit_path, 'audit must be an object')
            return
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
        if 'roots' in counts and counts['roots'] != 49:
            self.error(audit_path, 'counts.roots must be 49')
        if 'schema_version' in audit and (type(audit['schema_version']) is not int or audit['schema_version'] != 1):
            self.error(audit_path, 'schema_version must be 1')
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
        self.checks.extend(['standalone coverage crosswalk and preserved native verdicts',
                            'current resolution quotes, canonical headings, and dispositions',
                            'explicit current reference extensions and scoped recorded acceptance'])
        path = self.root / 'assets/coverage-audit.json'
        report = self.evidence_report('assets/coverage-audit.json')
        if report is None:
            return
        method = report.get('method')
        if not ((isinstance(method, str) and method.strip()) or (isinstance(method, dict) and method)):
            self.error(path, 'method must describe the frozen native audit and explicit resolution procedure')
        processing = report.get('processing')
        if not isinstance(processing, dict):
            self.error(path, 'processing must be an object')
            processing = {}
        # These processing totals describe the accepted historical native batch,
        # not the current active-reference inventory.
        for key, total in (('source', 467), ('references', HISTORICAL_REFERENCE_COUNT)):
            self.compare_counts(path, f'processing.{key}', processing.get(key),
                                {'processed': total, 'errors': 0, 'truncated': 0})
        manifest_sources = self.manifest.get('sources', []) if isinstance(self.manifest, dict) else []
        audit_files = self.audit.get('files', []) if isinstance(self.audit, dict) else []
        roots = {row['id']: row for row in manifest_sources
                 if isinstance(row, dict) and isinstance(row.get('id'), str)} if isinstance(manifest_sources, list) else {}
        originals = {row['path']: row for row in audit_files
                     if isinstance(row, dict) and isinstance(row.get('path'), str)} if isinstance(audit_files, list) else {}
        sources, references = report.get('sources'), report.get('references')
        if not isinstance(sources, list):
            self.error(path, 'sources must be an array')
            sources = []
        if not isinstance(references, list):
            self.error(path, 'references must be an array')
            references = []
        source_paths, source_roots, reference_paths = set(), set(), set()
        native_sources, native_references = {}, {}
        native_source_choices, native_reference_choices = Counter(), Counter()
        source_choices, reference_choices = Counter(), Counter()
        explicit, native_only = 0, 0
        for index, row in enumerate(sources):
            label = f'sources[{index}]'
            if not isinstance(row, dict):
                self.error(path, f'{label}: must be an object')
                continue
            source = row.get('source')
            if not isinstance(source, str) or source not in originals:
                self.error(path, f'{label}: source must identify a bundled source-audit path')
                continue
            if source in source_paths:
                self.error(path, f'{label}: duplicate source {source}')
            source_paths.add(source)
            original = originals[source]
            identity = source.split('/')[2] if len(source.split('/')) > 2 else None
            if row.get('source_root') != identity or identity not in roots:
                self.error(path, f'{label}: source_root must match the original manifest ID')
            if identity in roots:
                source_roots.add(identity)
            if 'native_path' in row:
                self.error(path, f'{label}: native_path is not supported for source records')
            if row.get('sha256') != original.get('sha256'):
                self.error(path, f'{label}: sha256 differs from the original source snapshot')
            mappings = row.get('mapped_references')
            expected = roots.get(identity, {}).get('references')
            if (not isinstance(mappings, list) or not all(isinstance(item, str) for item in mappings)
                    or len(set(mappings)) != len(mappings) or not isinstance(expected, list)
                    or not all(isinstance(item, str) for item in expected)
                    or set(mappings) != set(expected)):
                self.error(path, f'{label}: mapped_references must exactly match the owning manifest root')
            else:
                for mapping in mappings:
                    target = self.safe_path(path, mapping, f'{label}.mapped_references')
                    if target not in self.references:
                        self.error(path, f'{label}: mapped reference is not packaged: {mapping}')
            native = row.get('native')
            native_sources[source] = native
            choice = self.native_choice(native, 'coverage')
            if choice is not None:
                native_source_choices[choice] += 1
            contradiction = native.get('contradiction') if isinstance(native, dict) else None
            risk = contradiction.get('bool') if isinstance(contradiction, dict) else None
            material = choice in ('partial', 'missing') or (type(risk) in (int, float) and risk >= 0.5)
            if identity == REMOVED_ROOT:
                required = {
                    'disposition': 'out_of_scope', 'reference': REMOVAL_REFERENCE,
                    'section': REMOVAL_SECTION, 'anchor': REMOVAL_ANCHOR,
                    'evidence': EXCLUSION_QUOTE,
                }
                if not isinstance(row.get('resolution'), dict) or any(
                        row['resolution'].get(key) != value for key, value in required.items()):
                    self.error(path, f'{label}: excluded source must point to the exact out_of_scope removal record')
            resolution = row.get('resolution')
            if 'resolution' not in row:
                self.error(path, f'{label}: resolution is required (null only for native-only units)')
            if resolution is None:
                native_only += 1
                if original.get('flagged') is True or material:
                    self.error(path, f'{label}: historical flagged/material native candidate requires explicit resolution')
                if choice not in ('covered', 'out_of_scope'):
                    self.error(path, f'{label}: native-only source must be covered or out_of_scope')
            else:
                explicit += 1
                if isinstance(resolution, dict):
                    disposition = resolution.get('disposition')
                    if isinstance(disposition, str):
                        source_choices[disposition] += 1
                self.validate_resolution(path, label, resolution,
                                         resolution.get('reference') if isinstance(resolution, dict) else None,
                                         {'covered', 'corrected', 'out_of_scope'})
        if source_paths != set(originals) or len(sources) != 467:
            self.error(path, 'sources must contain each of the 467 original snapshot paths exactly once')
        if source_roots != set(roots) or len(roots) != 49:
            self.error(path, 'source roots must match all 49 manifest IDs')
        for index, row in enumerate(references):
            label = f'references[{index}]'
            if not isinstance(row, dict):
                self.error(path, f'{label}: must be an object')
                continue
            reference = row.get('path')
            target = self.safe_path(path, reference, f'{label}.path')
            if target is None:
                continue
            if reference in reference_paths:
                self.error(path, f'{label}: duplicate reviewed reference {reference}')
            reference_paths.add(reference)
            native = row.get('native')
            native_path = row.get('native_path', reference)
            if reference == VITEPRESS_GUIDE:
                if row.get('native_path') != OLD_GUIDE:
                    self.error(path, f'{label}: renamed reference must preserve native_path {OLD_GUIDE}')
            elif 'native_path' in row:
                self.error(path, f'{label}: native_path is permitted only for the fixed VitePress guide migration')
            if not isinstance(native_path, str):
                self.error(path, f'{label}: native_path must be the historical reference path')
            elif native_path in native_references:
                self.error(path, f'{label}: duplicate native reference identity {native_path}')
            else:
                native_references[native_path] = native
            choice = self.native_choice(native, 'readiness')
            if choice is not None:
                native_reference_choices[choice] += 1
            resolution = row.get('resolution')
            if isinstance(resolution, dict) and isinstance(resolution.get('disposition'), str):
                reference_choices[resolution['disposition']] += 1
            self.validate_resolution(path, label, resolution, reference, {'confirmed_fixed', 'overturned'})
        extension_paths = self.validate_reference_extensions(path, report, roots, reference_paths)
        active_paths = {self.display(reference) for reference in self.references}
        if (len(references) != HISTORICAL_REFERENCE_COUNT
                or reference_paths & set(CURRENT_REFERENCE_EXTENSIONS)):
            self.error(path, 'references must retain exactly the 38 historical native-reviewed paths, without extensions')
        if active_paths != reference_paths | extension_paths:
            self.error(path, 'active references must exactly match historical reviewed paths plus declared current extensions')
        self.compare_counts(path, 'current_reference_counts', report.get('current_reference_counts'), {
            'audited_original': HISTORICAL_REFERENCE_COUNT,
            'extensions': len(CURRENT_REFERENCE_EXTENSIONS),
            'active': ACTIVE_REFERENCE_COUNT,
        })
        counts = {
            'sources': len(sources), 'roots': len(source_roots), 'references': len(references),
            'explicit_source_reviews': explicit, 'native_only_sources': native_only,
            'source_resolution_choices': {key: source_choices[key] for key in ('covered', 'corrected', 'out_of_scope')},
            'native_source_choices': dict(native_source_choices),
            'native_reference_readiness': dict(native_reference_choices),
            'reference_resolution_choices': {key: reference_choices[key] for key in ('confirmed_fixed', 'overturned')},
        }
        self.compare_counts(path, 'counts', report.get('counts'), counts)
        for key in ('native_source_choices', 'native_reference_readiness'):
            self.compare_counts(path, key, counts[key], NATIVE_COUNTS[key])
        self.validate_native_fingerprint(path, 'sources', native_sources)
        self.validate_native_fingerprint(path, 'references', native_references)

    def validate_reference_extensions(self, path, report, roots, historical_paths):
        """Require explicit current reviews without fabricating native verdicts."""
        extensions = report.get('current_reference_extensions')
        if not isinstance(extensions, list):
            self.error(path, 'current_reference_extensions must be an array')
            extensions = []
        verification = self.load_json('assets/verification.json')
        checks = verification.get('checks', []) if isinstance(verification, dict) else []
        accepted_checks = {
            check['id'] for check in checks
            if isinstance(check, dict) and isinstance(check.get('id'), str)
            and check.get('result') in ('passed', 'observed')
        } if isinstance(checks, list) else set()
        paths = set()
        for index, row in enumerate(extensions):
            label = f'current_reference_extensions[{index}]'
            required = {'path', 'source_roots', 'resolution', 'verification_check_ids'}
            if not isinstance(row, dict) or set(row) != required:
                self.error(path, f'{label}: expected exactly {", ".join(sorted(required))}; no native verdict is supported')
                continue
            reference = row.get('path')
            if not isinstance(reference, str) or reference not in CURRENT_REFERENCE_EXTENSIONS:
                self.error(path, f'{label}: path must identify an explicitly declared current extension')
                continue
            if reference in paths or reference in historical_paths:
                self.error(path, f'{label}: duplicate reviewed extension {reference}')
            paths.add(reference)
            target = self.safe_path(path, reference, f'{label}.path')
            if target not in self.references or target not in self.indexed:
                self.error(path, f'{label}: extension must exist and be directly indexed')
            owners = row.get('source_roots')
            expected_owners = {identity for identity, root in roots.items()
                               if isinstance(root.get('references'), list) and reference in root['references']}
            if (not isinstance(owners, list) or not owners
                    or not all(isinstance(owner, str) for owner in owners)
                    or len(set(owners)) != len(owners) or set(owners) != expected_owners):
                self.error(path, f'{label}: source_roots must exactly match all owning manifest roots')
            resolution = row.get('resolution')
            self.validate_resolution(path, label, resolution, reference, {'reviewed'})
            if isinstance(resolution, dict) and not resolution.get('primary_urls'):
                self.error(path, f'{label}: extension review requires primary source URLs')
            identities = row.get('verification_check_ids')
            if (not isinstance(identities, list) or not identities
                    or not all(isinstance(identity, str) for identity in identities)
                    or len(set(identities)) != len(identities)
                    or not set(identities).issubset(accepted_checks)):
                self.error(path, f'{label}: verification_check_ids must name distinct passed/observed recorded checks')
        if paths != set(CURRENT_REFERENCE_EXTENSIONS) or len(extensions) != len(CURRENT_REFERENCE_EXTENSIONS):
            self.error(path, 'current_reference_extensions must review each explicitly declared extension exactly once')
        return paths

    def validate_verification(self):
        self.checks.extend(['scoped recorded verification metadata',
                            'complete content-addressed packaged file footprint (not runtime certification)'])
        relative = 'assets/verification.json'
        path = self.root / relative
        report = self.evidence_report(relative)
        if report is None:
            return
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
            if name not in current:
                continue
            try:
                hasher = hashlib.sha256()
                with target.open('rb') as stream:
                    for chunk in iter(lambda: stream.read(65536), b''):
                        hasher.update(chunk)
                if hasher.hexdigest() != digest:
                    self.error(path, f'stale packaged snapshot: {name}')
            except OSError as exc:
                self.error(path, f'cannot hash {name}: {exc}')
        for name in sorted(set(current) - set(files)):
            self.error(path, f'missing packaged snapshot: {name}')
        for name in sorted(set(files) - set(current)):
            self.error(path, f'extra packaged snapshot: {name}')

    def validate_package(self):
        self.checks.append('example package pinned dependencies, Bun lockfile and runnable scripts')
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
            'dependencies': {**BASELINE, 'pinia': '3.0.4', 'vue-router': '4.6.4'},
            'devDependencies': {
                '@vitejs/plugin-vue': '6.0.10', 'vite': '8.3.4',
                'typescript': '5.9.3', 'vue-tsc': '3.3.13',
                '@types/node': '24.19.2',
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

    def run(self):
        if not self.root.is_dir():
            self.error(self.root, 'skill root is not a directory')
        else:
            self.validate_documents()
            self.validate_provenance()
            self.validate_removals()
            self.validate_package()
            self.validate_coverage()
            self.validate_verification()
        return {'valid': not self.errors, 'checks': self.checks, 'errors': sorted(set(self.errors))}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('root', nargs='?', type=Path, default=Path(__file__).resolve().parent.parent, help='skill directory (default: script parent.parent)')
    parser.add_argument('--json', action='store_true', help='emit deterministic JSON instead of human-readable diagnostics')
    args = parser.parse_args()
    result = Validator(args.root).run()
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
