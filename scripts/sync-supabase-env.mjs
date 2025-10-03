#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function log(message) {
  console.log(`[db:env:local] ${message}`);
}

function error(message) {
  console.error(`[db:env:local] ${message}`);
}

function readSupabaseStatus() {
  let output;
  try {
    output = execFileSync('supabase', ['status', '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error('Supabase CLI not found on PATH. Install it before running this script.');
    }
    const stderr = err.stderr ? String(err.stderr) : '';
    throw new Error(`Failed to read Supabase status. ${stderr}`.trim());
  }

  let status;
  try {
    status = JSON.parse(output);
  } catch (err) {
    throw new Error('Unable to parse `supabase status --json` output.');
  }

  const services = status?.services ?? {};
  const api = services.api ?? services.supabase ?? services.rest ?? null;
  if (!api) {
    throw new Error('Supabase API service is not running. Start it with `supabase start`.');
  }

  const ports = api.ports ?? {};
  const firstPortKey = Object.keys(ports)[0];
  const inferredPort = firstPortKey ? ports[firstPortKey]?.port ?? Number(firstPortKey) : 54321;

  const restUrl = sanitizeUrl(
    api.restUrl ??
      api.rest_url ??
      api.url ??
      (inferredPort ? `http://127.0.0.1:${inferredPort}` : null)
  );
  const anonKey = api.anonKey ?? api.anon_key ?? api.apiKey ?? api.api_key ?? api.apiKeys?.anon ?? api.api_keys?.anon;
  const serviceRoleKey =
    api.serviceRoleKey ??
    api.service_role_key ??
    api.serviceKey ??
    api.service_key ??
    api.apiKeys?.service_role ??
    api.api_keys?.service_role;

  if (!restUrl) {
    throw new Error('Could not determine Supabase REST URL from status output.');
  }

  if (!anonKey || !serviceRoleKey) {
    throw new Error('Supabase API keys were not found. Wait for `supabase start` to finish and try again.');
  }

  return {restUrl, anonKey, serviceRoleKey};
}

function sanitizeUrl(url) {
  if (!url) return url;
  const trimmed = url.trim();
  if (trimmed.endsWith('/')) {
    return trimmed.slice(0, -1);
  }
  return trimmed;
}

function discoverAppEnvTargets() {
  const targets = [path.join(repoRoot, '.env.local')];
  const appsDir = path.join(repoRoot, 'apps');
  if (!existsSync(appsDir)) {
    return targets;
  }

  for (const entry of readdirSync(appsDir, {withFileTypes: true})) {
    if (!entry.isDirectory()) continue;
    const pkgPath = path.join(appsDir, entry.name, 'package.json');
    if (!existsSync(pkgPath)) continue;
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      const deps = {...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {})};
      if (deps.next) {
        targets.push(path.join(appsDir, entry.name, '.env.local'));
      }
    } catch (err) {
      error(`Skipping ${entry.name}: unable to parse package.json (${err.message}).`);
    }
  }

  return targets;
}

function ensureFileDir(filePath) {
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, {recursive: true});
  }
}

function updateEnvFile(filePath, values) {
  ensureFileDir(filePath);

  const lines = existsSync(filePath)
    ? readFileSync(filePath, 'utf8').split(/\r?\n/)
    : [];

  const indexByKey = new Map();
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=/);
    if (match) {
      indexByKey.set(match[1], i);
    }
  }

  let changed = false;
  for (const [key, value] of Object.entries(values)) {
    if (!value) continue;
    const newLine = `${key}=${value}`;
    if (indexByKey.has(key)) {
      const idx = indexByKey.get(key);
      if (lines[idx] !== newLine) {
        lines[idx] = newLine;
        changed = true;
      }
    } else {
      if (lines.length > 0 && lines[lines.length - 1] !== '') {
        lines.push('');
      }
      lines.push(newLine);
      changed = true;
    }
  }

  if (!changed) {
    log(`No changes needed for ${path.relative(repoRoot, filePath)}`);
    return;
  }

  const output = lines.filter((line, idx, arr) => !(line === '' && idx === arr.length - 1)).join('\n');
  writeFileSync(filePath, `${output}\n`, {encoding: 'utf8'});
  log(`Updated ${path.relative(repoRoot, filePath)}`);
}

function main() {
  let status;
  try {
    status = readSupabaseStatus();
  } catch (err) {
    error(err.message);
    process.exitCode = 1;
    return;
  }

  const targets = discoverAppEnvTargets();
  const values = {
    SUPABASE_URL: status.restUrl,
    SUPABASE_ANON_KEY: status.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: status.serviceRoleKey,
    NEXT_PUBLIC_SUPABASE_URL: status.restUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: status.anonKey
  };

  for (const target of targets) {
    updateEnvFile(target, values);
  }
}

main();
