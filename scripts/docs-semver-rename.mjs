#!/usr/bin/env node
/**
 * Docs SemVer Normalizer
 * Scans docs/, classifies files into standard folders, renames them with
 * SemVer suffixes, normalises YAML front-matter, and refreshes docs/INDEX.md.
 *
 * Dry-run by default. Pass --apply to perform filesystem/git mutations.
 */
import { promises as fs } from 'fs';
import path from 'path';
import cp from 'child_process';

const DOCS_ROOT = path.resolve('docs');
const APPLY = process.argv.includes('--apply');

const TYPE_FOLDERS = [
  'specs',
  'architecture',
  'agents',
  'guides',
  'getting-started',
  'runbooks',
  'policies',
  'compliance',
  'rfcs',
];

const FOLDER_ALIASES = new Map([
  ['specs', 'specs'],
  ['architecture', 'architecture'],
  ['adr', 'architecture'],
  ['agents', 'agents'],
  ['guides', 'guides'],
  ['guide', 'guides'],
  ['getting-started', 'getting-started'],
  ['getting_started', 'getting-started'],
  ['runbooks', 'runbooks'],
  ['ops', 'runbooks'],
  ['operations', 'runbooks'],
  ['policies', 'policies'],
  ['policy', 'policies'],
  ['security', 'policies'],
  ['compliance', 'compliance'],
  ['legal', 'compliance'],
  ['rfcs', 'rfcs'],
  ['rfc', 'rfcs'],
]);

const TYPE_HEURISTICS = [
  ['specs', /(spec|requirement|white[_-]?label|admin[_-]?app[_-]?spec|architecture\s*spec|extension|workflow[-_ ]agnostic)/i],
  ['architecture', /(\bard\b|\badr\b|architecture|design|system[-_ ]diagram)/i],
  ['agents', /(\bagent\b|agents|coding[-_ ]?agent|agent[-_ ]?policy)/i],
  ['guides', /(guide|how[-_ ]?to|supabase|workflow|roadmap)/i],
  ['getting-started', /(getting[-_ ]?started|local[-_ ]?development|codespaces|quickstart|onboarding)/i],
  ['runbooks', /(runbook|incident|on[-_ ]?call|operations|observability)/i],
  ['policies', /(policy|access|change|vendor|security|auth[-_ ]review)/i],
  ['compliance', /(soc2|control|evidence|privacy|confidentiality|dpa|dpia|terms|cookies|data[-_ ]retention)/i],
  ['rfcs', /(\brfc\b|proposal|design[-_ ]?draft)/i],
];

const LOCKED_CANONICAL = new Map([
  ['freshcomply-spec', 'FreshComply-Spec'],
  ['agents', 'agents'],
  ['ard', 'ARD'],
]);

const SLUG_OVERRIDES = new Map([
  ['fresh-comply-consolidated-requirements-spec', 'freshcomply-requirements'],
  ['fresh-comply-white-label-multi-tenant-architecture', 'white-label-architecture'],
  ['fresh-comply-admin-app-spec', 'admin-app-spec'],
  ['freshcomply-consolidated-spec', 'freshcomply-consolidated-spec'],
]);

const SPECIAL_WORDS = new Map([
  ['api', 'API'],
  ['ard', 'ARD'],
  ['adr', 'ADR'],
  ['gdpr', 'GDPR'],
  ['soc2', 'SOC 2'],
  ['cli', 'CLI'],
  ['ui', 'UI'],
  ['supabase', 'Supabase'],
  ['freshcomply', 'FreshComply'],
  ['rls', 'RLS'],
  ['faq', 'FAQ'],
]);

const SKIP_TOP_LEVEL = new Set(['_archive', 'archive']);

async function walk(dir) {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of dirents) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const rel = path.relative(DOCS_ROOT, full);
      const top = rel.split(path.sep)[0];
      if (SKIP_TOP_LEVEL.has(top)) continue;
      files.push(...(await walk(full)));
    } else if (/\.md$/i.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function normaliseString(input) {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .trim();
}

function stripVersionSuffix(name) {
  const match = name.match(/^(.*)\.v\d+\.\d+\.\d+$/i);
  return match ? match[1] : name;
}

function stripDateTokens(name) {
  return name
    .replace(/_v_?\d{4}_\d{2}_\d{2}/gi, '')
    .replace(/20\d{2}[-_]\d{2}[-_]\d{2}/g, '')
    .replace(/\b20\d{2}\b/g, '')
    .replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/gi, '')
    .replace(/--+/g, '-')
    .replace(/__+/g, '_');
}

function slugify(value) {
  const cleaned = normaliseString(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .replace(/[_\s]+/g, '-');
  return cleaned.replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function inferType(relativePath) {
  const segments = relativePath.split(path.sep);
  const topSegment = segments[0];
  if (SKIP_TOP_LEVEL.has(topSegment)) return null;
  const alias = FOLDER_ALIASES.get(topSegment.toLowerCase());
  if (alias) return alias;

  const base = segments[segments.length - 1];
  for (const [type, rx] of TYPE_HEURISTICS) {
    if (rx.test(base)) return type;
  }
  return 'guides';
}

function parseFrontMatter(text) {
  if (!text.startsWith('---')) {
    return { frontMatter: {}, body: text };
  }
  const end = text.indexOf('\n---', 3);
  if (end === -1) return { frontMatter: {}, body: text };
  const raw = text.slice(3, end).trim();
  const body = text.slice(end + 4).replace(/^\r?\n/, '');
  const fm = {};
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (match) {
      const value = decodeYamlValue(match[2].trim());
      fm[match[1]] = value;
    }
  }
  return { frontMatter: fm, body };
}

function decodeYamlValue(value) {
  let current = value;
  let changed = true;
  while (changed) {
    changed = false;
    if ((current.startsWith('"') && current.endsWith('"')) || (current.startsWith("'") && current.endsWith("'"))) {
      current = current.slice(1, -1);
      changed = true;
      continue;
    }
    const replaced = current
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, '\\');
    if (replaced !== current) {
      current = replaced;
      changed = true;
    }
  }
  return current;
}

function extractFirstHeading(markdown) {
  const lines = markdown.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^#\s+(.*)$/);
    if (match) {
      return match[1].trim();
    }
  }
  return null;
}

function titleCaseFromSlug(slug) {
  if (!slug) return 'Untitled';
  const words = slug.split(/[-\s_]+/);
  return words
    .map((word) => {
      const lower = word.toLowerCase();
      if (SPECIAL_WORDS.has(lower)) return SPECIAL_WORDS.get(lower);
      if (lower.length === 0) return '';
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .filter(Boolean)
    .join(' ')
    .replace(/\bUi\b/g, 'UI');
}

function ensureVersionString(value, fallback) {
  const match = typeof value === 'string' && value.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (match) return match[0];
  return fallback;
}

function determineInitialVersion(name, type) {
  const hasDate = /20\d{2}[-_]\d{2}[-_]\d{2}/.test(name) || /_v_\d{4}_\d{2}_\d{2}/i.test(name);
  if (hasDate) return '1.0.0';
  if (type === 'specs' || type === 'architecture' || type === 'policies' || type === 'compliance' || type === 'agents') {
    return '1.0.0';
  }
  return '0.1.0';
}

function determineStatus(slugKey, version, existingStatus) {
  if (existingStatus) {
    const normalised = existingStatus.trim();
    if (/^(Stable|Draft|Locked)$/i.test(normalised)) {
      const match = normalised.match(/(Stable|Draft|Locked)/);
      if (match) return match[1];
    }
  }
  if (LOCKED_CANONICAL.has(slugKey)) return 'Locked';
  if (version.startsWith('0.')) return 'Draft';
  return 'Stable';
}

function canonicalSlug(slugKey) {
  if (LOCKED_CANONICAL.has(slugKey)) {
    return LOCKED_CANONICAL.get(slugKey);
  }
  return slugKey;
}

function buildFrontMatter({ title, version, status }) {
  const quote = (value) => {
    const escaped = String(value).replace(/"/g, '\\"');
    return `"${escaped}"`;
  };
  const lines = [
    `title: ${quote(title)}`,
    `version: ${version}`,
    `status: ${status}`,
  ];
  return `---\n${lines.join('\n')}\n---\n\n`;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function gitMove(src, dest) {
  try {
    cp.execFileSync('git', ['mv', src, dest], { stdio: 'inherit' });
    return true;
  } catch (error) {
    return false;
  }
}

function planIndex(groups) {
  const now = new Date().toISOString();
  let content = `# Docs Index\n\nGenerated on ${now}\n\n`;
  const sortedTypes = Object.keys(groups).sort();
  for (const type of sortedTypes) {
    content += `## ${type}\n\n`;
    const entries = groups[type].sort((a, b) => a.relative.localeCompare(b.relative));
    for (const entry of entries) {
      const relPath = entry.relative.replace(/\\/g, '/');
      content += `- [${entry.title}](${relPath}) — v${entry.version} (${entry.status})\n`;
    }
    content += '\n';
  }
  return content;
}

function computeSlugBase({ title, fileBase, slugFromName }) {
  if (slugFromName) {
    if (slugFromName === 'readme') return 'index';
    return slugFromName;
  }
  if (title && title !== 'Untitled') {
    const raw = stripDateTokens(title);
    const slugged = slugify(raw);
    if (slugged) return slugged;
  }
  if (fileBase) {
    const cleaned = stripDateTokens(stripVersionSuffix(fileBase));
    const slugged = slugify(cleaned || fileBase);
    if (slugged === 'readme') return 'index';
    return slugged;
  }
  return 'untitled';
}

function cleanupTitle(rawTitle, slugBase) {
  if (rawTitle && rawTitle.trim().length > 0 && rawTitle !== 'Untitled') {
    let normalized = normaliseString(rawTitle)
      .replace(/^\"+|\"+$/g, '')
      .replace(/^"+|"+$/g, '')
      .replace(/^'+|'+$/g, '');
    normalized = normalized.replace(/\\"/g, '"').replace(/\\'+/g, "'");
    normalized = normalized.replace(/\\+/g, '\\');
    normalized = normalized.replace(/^\\+|\\+$/g, '');
    if (normalized.trim().length > 0) return normalized.trim();
  }
  return titleCaseFromSlug(slugBase);
}

(async () => {
  const allFiles = await walk(DOCS_ROOT);
  const plan = [];
  const indexGroups = {};

  for (const filePath of allFiles) {
    const relative = path.relative(DOCS_ROOT, filePath);
    if (relative === 'INDEX.md') continue;
    const type = inferType(relative);
    if (!type) continue;

    const raw = await fs.readFile(filePath, 'utf8');
    const { frontMatter, body } = parseFrontMatter(raw);
    const firstHeading = extractFirstHeading(body);

    const baseName = path.basename(filePath, '.md');
    const versionFromNameMatch = baseName.match(/\.v(\d+\.\d+\.\d+)$/);
    const versionFromName = versionFromNameMatch ? versionFromNameMatch[1] : null;
    const nameWithoutVersion = versionFromName ? baseName.replace(/\.v\d+\.\d+\.\d+$/, '') : baseName;

    const initialTitle = frontMatter.title || firstHeading || nameWithoutVersion;
    const slugFromName = slugify(stripDateTokens(stripVersionSuffix(nameWithoutVersion)));
    const slugBaseCandidate = computeSlugBase({ title: initialTitle, fileBase: nameWithoutVersion, slugFromName });
    const slugKey = slugify(slugBaseCandidate);
    const canonical = canonicalSlug(slugKey);
    const override = SLUG_OVERRIDES.get(slugKey);
    const slugBase = LOCKED_CANONICAL.has(slugKey)
      ? canonical
      : override || slugKey || 'untitled';

    const version = ensureVersionString(frontMatter.version || versionFromName, determineInitialVersion(baseName, type));
    const status = determineStatus(slugKey, version, frontMatter.status);
    const title = cleanupTitle(frontMatter.title || firstHeading, slugBase);

    const finalName = LOCKED_CANONICAL.has(slugKey)
      ? `${canonical}.v${version}.md`
      : `${slugBase}.v${version}.md`;
    const destinationDir = path.join(DOCS_ROOT, type);
    const destinationPath = path.join(destinationDir, finalName);
    const destinationRelative = path.relative('.', destinationPath);

    const fm = buildFrontMatter({ title, version, status });
    const newContent = fm + body.trimEnd() + '\n';

    plan.push({
      sourcePath: filePath,
      destinationPath,
      destinationDir,
      newContent,
      title,
      version,
      status,
      type,
      destinationRelative: path.relative('docs', destinationPath),
    });

    (indexGroups[type] ||= []).push({
      title,
      version,
      status,
      relative: path.relative('docs', destinationPath),
    });
  }

  if (!APPLY) {
    console.log('Docs SemVer Normalizer — dry run');
    for (const item of plan) {
      if (path.resolve(item.sourcePath) !== path.resolve(item.destinationPath)) {
        console.log(`${path.relative('.', item.sourcePath)} -> ${path.relative('.', item.destinationPath)}`);
      } else {
        console.log(`${path.relative('.', item.sourcePath)} (normalize front-matter)`);
      }
    }
    console.log('\nNo files were changed. Run with --apply to execute the plan.');
    return;
  }

  for (const item of plan) {
    await ensureDir(item.destinationDir);
    const samePath = path.resolve(item.sourcePath) === path.resolve(item.destinationPath);
    if (!samePath) {
      const moved = gitMove(item.sourcePath, item.destinationPath);
      if (!moved) {
        await fs.rename(item.sourcePath, item.destinationPath);
      }
    }
    await fs.writeFile(item.destinationPath, item.newContent, 'utf8');
  }

  const indexContent = planIndex(indexGroups).trimEnd() + '\n';
  await fs.writeFile(path.join(DOCS_ROOT, 'INDEX.md'), indexContent, 'utf8');
  console.log('✅ Applied renames and regenerated docs/INDEX.md');
})();
