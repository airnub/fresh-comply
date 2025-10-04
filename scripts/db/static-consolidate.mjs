#!/usr/bin/env node
/**
 * Static Postgres migration consolidator (no DB).
 * - Scans SQL in packages subdirectories ("migrations") and supabase/migrations
 * - Orders deterministically
 * - Parses statements and builds a schema model
 * - Emits a clean, minimal baseline under supabase/migrations/
 *   with Supabase-style filenames YYYYMMDDHHMMSS_<slug>.sql
 *
 * Limitations:
 * - Covers common PG DDL: CREATE/DROP TABLE, ALTER TABLE (ADD/DROP/ALTER/RENAME),
 *   CREATE [OR REPLACE] FUNCTION, CREATE VIEW/MATERIALIZED VIEW, CREATE TYPE/DOMAIN,
 *   CREATE INDEX, CREATE EXTENSION, CREATE/DROP POLICY, RLS enable/disable, TRIGGER, SCHEMA, SEQUENCE, GRANT.
 * - Unsupported/complex statements are preserved verbatim into a final post file.
 */

import { promises as fs } from "fs";
import path from "path";

const ROOT = process.cwd();
const TARGET_DIR = path.join("supabase", "migrations");
const SOURCES = [
  "packages/db/migrations",
  "supabase/migrations",
  "packages", // catch any packages/*/migrations
];

const OUT = path.join(TARGET_DIR);
const LOG = (...a) => console.log(...a);
const WARN = (...a) => console.warn("⚠️", ...a);

/* ---------------------  helpers --------------------- */
async function listSqlFiles() {
  const files = new Set();
  async function addDir(d) {
    const abs = path.join(ROOT, d);
    try { const st = await fs.stat(abs); if (!st.isDirectory()) return; } catch { return; }
    const ents = await fs.readdir(abs, { withFileTypes: true });
    for (const e of ents) {
      const p = path.join(abs, e.name);
      if (e.isDirectory()) {
        if (e.name === "migrations" || d.includes("packages")) {
          await addDir(path.join(d, e.name));
        } else {
          if (d.startsWith("packages") && e.name !== "node_modules") {
            await addDir(path.join(d, e.name));
          }
        }
      } else if (e.isFile() && e.name.endsWith(".sql")) {
        files.add(p);
      }
    }
  }
  for (const s of SOURCES) await addDir(s);
  return Array.from(files);
}

function orderFiles(files) {
  function key(f) {
    const base = path.basename(f);
    const m = base.match(/^(\d{12,14})/) || base.match(/(\d{12,14})/);
    const ts = m ? m[1] : "99999999999999";
    return `${ts}___${base}___${f}`;
  }
  return files.sort((a,b)=> key(a).localeCompare(key(b)));
}

// Split SQL into statements, respecting comments and dollar-quoted bodies
function splitStatements(sql) {
  const out = [];
  let i=0, buf="", inDollar=false, tag=null, inLine=false, inBlock=false;
  while (i < sql.length) {
    const ch = sql[i], ch2 = sql.slice(i, i+2);
    if (!inDollar && !inBlock && ch2 === "--") { inLine = true; buf += ch; i++; continue; }
    if (inLine && ch === "\n") inLine = false;
    if (!inDollar && !inLine && ch2 === "/*") { inBlock = true; buf += ch2; i+=2; continue; }
    if (inBlock) { buf += ch; if (ch2 === "*/") { buf += "*"; i++; inBlock=false; } i++; continue; }
    if (!inLine && !inBlock && ch === "$") {
      const m = sql.slice(i).match(/^\$[a-zA-Z0-9_]*\$/);
      if (m) {
        const t = m[0];
        if (!inDollar) { inDollar = true; tag = t; buf += t; i += t.length; continue; }
        else if (t === tag) { inDollar = false; buf += t; i += t.length; continue; }
      }
    }
    if (!inDollar && !inLine && !inBlock && ch === ";") { buf += ch; out.push(buf.trim()); buf = ""; i++; continue; }
    buf += ch; i++;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

const MODEL = {
  extensions: new Map(),
  schemas: new Map(),
  types: new Map(),
  domains: new Map(),
  tables: new Map(),         // key: schema.name => { columns Map, constraints Map, opts, rawCreate }
  indexes: new Map(),
  functions: new Map(),
  views: new Map(),
  matviews: new Map(),
  policies: new Map(),
  triggers: new Map(),
  sequences: new Map(),
  grants: [],
  rlsEnable: new Set(),
  post: []
};

function fq(schema, name) { return `${schema}.${name}`; }
function parseIdent(s) {
  const m = s.match(/^(?:"([^"]+)"|([a-zA-Z_][\w$]*))(?:\.(?:"([^"]+)"|([a-zA-Z_][\w$]*)))?$/);
  if (!m) return null;
  return { schema: (m[3] || m[4]) ? (m[1]||m[2]) : null, name: (m[3] || m[4]) || (m[1]||m[2]) };
}

function handleCreateExtension(stmt){ const m=stmt.match(/create\s+extension\s+(if\s+not\s+exists\s+)?("?[\w-]+"?)/i); if(!m) return false; MODEL.extensions.set(m[2].replace(/"/g,""), stmt); return true; }
function handleCreateSchema(stmt){ const m=stmt.match(/create\s+schema\s+(if\s+not\s+exists\s+)?("?[\w$]+"?)/i); if(!m) return false; MODEL.schemas.set(m[2].replace(/"/g,""), stmt); return true; }
function handleCreateTypeOrDomain(stmt){
  if(/create\s+type/i.test(stmt)){ const m=stmt.match(/create\s+type\s+((?:"?[\w$]+"?\.)?"?[\w$]+"?)/i); if(!m) return false; const {schema,name}=parseIdent(m[1])||{}; MODEL.types.set(fq(schema||"public",name), stmt); return true; }
  if(/create\s+domain/i.test(stmt)){ const m=stmt.match(/create\s+domain\s+((?:"?[\w$]+"?\.)?"?[\w$]+"?)/i); if(!m) return false; const {schema,name}=parseIdent(m[1])||{}; MODEL.domains.set(fq(schema||"public",name), stmt); return true; }
  return false;
}
function ensureTable(schema,name){ const key=fq(schema,name); if(!MODEL.tables.has(key)) MODEL.tables.set(key,{ columns:new Map(), constraints:new Map(), opts:{rls:false}, rawCreate:null }); return MODEL.tables.get(key); }
function handleCreateTable(stmt){
  const m=stmt.match(/create\s+table\s+(if\s+not\s+exists\s+)?((?:"?[\w$]+"?\.)?"?[\w$]+"?)\s*\(([\s\S]*)\)\s*;/i); if(!m) return false;
  const id=parseIdent(m[2])||{}; const schema=id.schema||"public"; const name=id.name; const body=m[3];
  const table=ensureTable(schema,name); table.columns.clear(); table.constraints.clear(); table.rawCreate=stmt;
  let level=0, token="", parts=[]; for(let i=0;i<body.length;i++){ const ch=body[i]; if(ch==="(") level++; if(ch===")") level--; if(ch==="," && level===0){ parts.push(token.trim()); token=""; } else token+=ch; } if(token.trim()) parts.push(token.trim());
  for(const p of parts){ if(/^constraint\s+/i.test(p) || (/\b(primary key|foreign key|unique|check)\b/i.test(p) && !/^\w+\s+\w+/i.test(p))){ const nm=(p.match(/^constraint\s+("?[\w$]+"?)/i)?.[1]||`anon_${table.constraints.size+1}`).replace(/"/g,""); table.constraints.set(nm,p); continue; }
    const cm=p.match(/^("?[\w$]+"?)\s+([\s\S]+)$/); if(!cm){ table.constraints.set(`raw_${table.constraints.size+1}`,p); continue; } const col=cm[1].replace(/"/g,""); const def=cm[2].trim(); table.columns.set(col,def); }
  return true; }
function handleAlterTable(stmt){
  const m=stmt.match(/alter\s+table\s+(if\s+exists\s+)?((?:"?[\w$]+"?\.)?"?[\w$]+"?)\s+([\s\S]*);$/i); if(!m) return false;
  const id=parseIdent(m[2])||{}; const schema=id.schema||"public"; let name=id.name; const table=ensureTable(schema,name);
  const ops=m[3].split(/,(?![^\(]*\))/).map(s=>s.trim());
  for(const op of ops){
    const rn=op.match(/^rename\s+to\s+("?[\w$]+"?)/i); if(rn){ const nn=rn[1].replace(/"/g,""); const old=fq(schema,name); const t=MODEL.tables.get(old); MODEL.tables.delete(old); name=nn; MODEL.tables.set(fq(schema,name), t); continue; }
    const addc=op.match(/^add\s+column\s+(if\s+not\s+exists\s+)?("?[\w$]+"?)\s+([\s\S]+)$/i); if(addc){ const col=addc[2].replace(/"/g,""); const def=addc[3].trim(); table.columns.set(col,def); continue; }
    const dropc=op.match(/^drop\s+column\s+(if\s+exists\s+)?("?[\w$]+"?)/i); if(dropc){ const col=dropc[2].replace(/"/g,""); table.columns.delete(col); continue; }
    const altc=op.match(/^alter\s+column\s+("?[\w$]+"?)\s+([\s\S]+)$/i); if(altc){ const col=altc[1].replace(/"/g,""); const action=altc[2].trim(); const cur=table.columns.get(col)||"";
      if(/set\s+not\s+null/i.test(action)){ table.columns.set(col, cur.replace(/\bnull\b/gi,"").trim()+" NOT NULL"); }
      else if(/drop\s+not\s+null/i.test(action)){ table.columns.set(col, cur.replace(/\s+NOT\s+NULL\b/gi,"").trim()); }
      else if(/set\s+default\s+(.+)/i.test(action)){ const d=action.match(/set\s+default\s+(.+)/i)[1]; let nd=cur.replace(/\s+default\s+[^ ]+/i,"").trim(); nd += ` DEFAULT ${d}`; table.columns.set(col, nd.trim()); }
      else if(/drop\s+default/i.test(action)){ table.columns.set(col, cur.replace(/\s+default\s+[^ ]+/i,"").trim()); }
      else if(/type\s+(.+)/i.test(action)){ const t=action.match(/type\s+(.+)/i)[1]; const nd=cur.replace(/^[^\s]+/, t); table.columns.set(col, nd.trim()); }
      else if(/rename\s+to\s+("?[\w$]+"?)/i.test(action)){ const nn=action.match(/rename\s+to\s+("?[\w$]+"?)/i)[1].replace(/"/g,""); const ov=table.columns.get(col)||""; table.columns.delete(col); table.columns.set(nn, ov); }
      else { MODEL.post.push("-- UNSUPPORTED ALTER COLUMN op kept verbatim:\n" + `ALTER TABLE ${fq(schema,name)} ${op};`); }
      continue; }
    const addk=op.match(/^add\s+constraint\s+("?[\w$]+"?)\s+([\s\S]+)$/i); if(addk){ const cname=addk[1].replace(/"/g,""); const body=addk[2].trim(); table.constraints.set(cname, body); continue; }
    const dropk=op.match(/^drop\s+constraint\s+(if\s+exists\s+)?("?[\w$]+"?)/i); if(dropk){ const cname=dropk[2].replace(/"/g,""); table.constraints.delete(cname); continue; }
    MODEL.post.push("-- UNSUPPORTED ALTER TABLE op kept verbatim:\n" + `ALTER TABLE ${fq(schema,name)} ${op};`);
  }
  return true;
}
function handleRLS(stmt){ const en=stmt.match(/alter\s+table\s+((?:"?[\w$]+"?\.)?"?[\w$]+"?)\s+enable\s+row\s+level\s+security/i); const dis=stmt.match(/alter\s+table\s+((?:"?[\w$]+"?\.)?"?[\w$]+"?)\s+disable\s+row\s+level\s+security/i); if(!en && !dis) return false; const id=parseIdent((en||dis)[1])||{}; const schema=id.schema||"public"; const key=fq(schema,id.name); if(en) MODEL.rlsEnable.add(key); else MODEL.rlsEnable.delete(key); return true; }
function handlePolicy(stmt){ if(!/create\s+policy/i.test(stmt)) return false; const m=stmt.match(/create\s+policy\s+("?[\w$]+"?).*on\s+((?:"?[\w$]+"?\.)?"?[\w$]+"?)/i); if(!m) return false; const pname=m[1].replace(/"/g,""); const id=parseIdent(m[2])||{}; const schema=id.schema||"public"; const key=`${fq(schema,id.name)}::${pname}`; MODEL.policies.set(key, stmt); return true; }
function handleFunction(stmt){ if(!/create\s+(or\s+replace\s+)?function/i.test(stmt)) return false; const m=stmt.match(/create\s+(or\s+replace\s+)?function\s+((?:"?[\w$]+"?\.)?"?[\w$]+"?)\s*\(/i); if(!m) return false; const head=m[2]; const id=parseIdent(head)||{}; const schema=id.schema||"public"; const sig=`${fq(schema,id.name)}(${extractArgsSig(stmt.slice(stmt.indexOf(m[0])+m[0].length-1))})`; MODEL.functions.set(sig, stmt); return true; }
function extractArgsSig(rest){ let level=0, s=""; for(let i=0;i<rest.length;i++){ const ch=rest[i]; s+=ch; if(ch==="(") level++; if(ch===")"){ level--; if(level===0) return s.slice(1,-1).replace(/\s+/g," ").trim(); } } return ""; }
function handleView(stmt){ if(/create\s+(or\s+replace\s+)?materialized\s+view/i.test(stmt)){ const m=stmt.match(/create\s+(or\s+replace\s+)?materialized\s+view\s+((?:"?[\w$]+"?\.)?"?[\w$]+"?)/i); if(!m) return false; const id=parseIdent(m[2])||{}; MODEL.matviews.set(fq(id.schema||"public", id.name), stmt); return true; } if(/create\s+(or\s+replace\s+)?view/i.test(stmt)){ const m=stmt.match(/create\s+(or\s+replace\s+)?view\s+((?:"?[\w$]+"?\.)?"?[\w$]+"?)/i); if(!m) return false; const id=parseIdent(m[2])||{}; MODEL.views.set(fq(id.schema||"public", id.name), stmt); return true; } return false; }
function handleIndex(stmt){ if(!/create\s+(unique\s+)?index/i.test(stmt)) return false; const m=stmt.match(/create\s+(unique\s+)?index\s+(if\s+not\s+exists\s+)?("?[\w$]+"?)/i); if(!m) return false; const name=(m[3]||"").replace(/"/g,""); MODEL.indexes.set(name, stmt); return true; }
function handleTrigger(stmt){ if(!/create\s+trigger/i.test(stmt)) return false; const m=stmt.match(/create\s+trigger\s+("?[\w$]+"?)/i); if(!m) return false; const name=m[1].replace(/"/g,""); MODEL.triggers.set(name, stmt); return true; }
function handleSequence(stmt){ if(!/create\s+sequence/i.test(stmt)) return false; const m=stmt.match(/create\s+sequence\s+((?:"?[\w$]+"?\.)?"?[\w$]+"?)/i); if(!m) return false; const id=parseIdent(m[1])||{}; MODEL.sequences.set(fq(id.schema||"public", id.name), stmt); return true; }
function handleGrant(stmt){ if(!/grant\s+/i.test(stmt)) return false; MODEL.grants.push(stmt); return true; }

(async () => {
  const files = orderFiles(await listSqlFiles());
  if (!files.length) { console.error("No SQL files found."); process.exit(1); }
  LOG(`📚 Consolidating ${files.length} migration files…`);

  for (const file of files) {
    const raw = await fs.readFile(file, "utf8");
    const statements = splitStatements(raw);
    for (const s of statements) {
      const stmt = s.trim(); if (!stmt) continue;
      const handled =
        handleCreateExtension(stmt) ||
        handleCreateSchema(stmt) ||
        handleCreateTypeOrDomain(stmt) ||
        handleSequence(stmt) ||
        handleCreateTable(stmt) ||
        handleAlterTable(stmt) ||
        handleRLS(stmt) ||
        handlePolicy(stmt) ||
        handleFunction(stmt) ||
        handleView(stmt) ||
        handleIndex(stmt) ||
        handleTrigger(stmt) ||
        handleGrant(stmt);
      if (!handled) MODEL.post.push(stmt);
    }
  }

  // Build output files (Supabase-style timestamped names)
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(OUT, { recursive: true });

  const header = (t)=>`-- Auto-consolidated baseline (${new Date().toISOString()})\n-- ${t}\n\n`;

  function mkTsCursor(baseStr) {
    const pad = (n)=> String(n).padStart(2, "0");
    let base = baseStr ? baseStr : (() => {
      const d = new Date();
      return (
        d.getUTCFullYear().toString() +
        pad(d.getUTCMonth() + 1) +
        pad(d.getUTCDate()) +
        pad(d.getUTCHours()) +
        pad(d.getUTCMinutes()) +
        pad(d.getUTCSeconds())
      );
    })();
    let seq = 0;
    return {
      next() {
        // emit base, then base+1s, base+2s … (UTC)
        const y = base.slice(0,4), mo = base.slice(4,6), da = base.slice(6,8), hh = base.slice(8,10), mm = base.slice(10,12), ss = base.slice(12,14);
        const dt = new Date(Date.UTC(+y, +mo-1, +da, +hh, +mm, +ss + seq++));
        const z = (n)=> String(n).padStart(2, "0");
        return (
          dt.getUTCFullYear().toString() + z(dt.getUTCMonth()+1) + z(dt.getUTCDate()) + z(dt.getUTCHours()) + z(dt.getUTCMinutes()) + z(dt.getUTCSeconds())
        );
      }
    };
  }

  const ts = mkTsCursor(process.env.BASE_TS); // optionally seed via BASE_TS=YYYYMMDDHHMMSS

  async function writeTs(slug, content) {
    const body = (content || "").trim();
    if (!body) return;
    const name = `${ts.next()}_${slug}.sql`;
    await fs.writeFile(path.join(OUT, name), body.endsWith("\n") ? body : body + "\n", "utf8");
    console.log("✍️  wrote", path.join(OUT, name));
  }

  // Compose content blocks from the in-memory MODEL
  const exts = Array.from(MODEL.extensions.values()).join("\n") + "\n";
  const schemas = Array.from(MODEL.schemas.values()).join("\n") + "\n";
  const typesDomains = Array.from(MODEL.types.values()).join("\n") + "\n" + Array.from(MODEL.domains.values()).join("\n") + "\n";

  let tablesSql = header("Tables (no FKs)");
  for (const [key, t] of Array.from(MODEL.tables.entries()).sort()) {
    const [schema, name] = key.split(".");
    const cols = Array.from(t.columns.entries()).map(([c,d]) => `  "${c}" ${d}`).join(",\n");
    const inlines = Array.from(t.constraints.entries())
      .filter(([_,body]) => !/\bforeign\s+key\b/i.test(body))
      .map(([n,body]) => `  CONSTRAINT "${n}" ${body}`)
      .join(",\n");
    const body = [cols, inlines].filter(Boolean).join(",\n");
    tablesSql += `CREATE TABLE ${schema}."${name}" (\n${body}\n);\n\n`;
  }

  const functions = Array.from(MODEL.functions.values()).join("\n\n") + "\n";

  let rls = header("RLS & Policies");
  for (const key of Array.from(MODEL.rlsEnable.values()).sort()) {
    rls += `ALTER TABLE ${key} ENABLE ROW LEVEL SECURITY;\n`;
  }
  rls += "\n" + Array.from(MODEL.policies.values()).join("\n") + "\n";

  let idxc = header("Constraints (FKs) & Indexes");
  for (const [key, t] of Array.from(MODEL.tables.entries()).sort()) {
    const fkCons = Array.from(t.constraints.entries()).filter(([_,body]) => /\bforeign\s+key\b/i.test(body));
    for (const [n, body] of fkCons) idxc += `ALTER TABLE ${key} ADD CONSTRAINT "${n}" ${body};\n`;
  }
  idxc += "\n" + Array.from(MODEL.indexes.values()).join("\n") + "\n";

  const views = Array.from(MODEL.views.values()).join("\n\n") + "\n\n" + Array.from(MODEL.matviews.values()).join("\n\n") + "\n";
  const triggers = Array.from(MODEL.triggers.values()).join("\n\n") + "\n";
  const post = (Array.from(MODEL.sequences.values()).join("\n") + "\n") + (MODEL.grants.join("\n") + "\n") + (MODEL.post.length ? ("\n-- Unsupported/kept verbatim:\n" + MODEL.post.join("\n\n") + "\n") : "");

  // Write in logical order with unique timestamps
  await writeTs("init_extensions", header("Extensions") + exts);
  await writeTs("schemas", header("Schemas") + schemas);
  await writeTs("types_domains", header("Types & Domains") + typesDomains);
  await writeTs("tables", tablesSql);
  await writeTs("functions", header("Functions") + functions);
  await writeTs("rls_policies", rls);
  await writeTs("indexes_constraints", idxc);
  await writeTs("views_matviews", header("Views & Materialized Views") + views);
  await writeTs("triggers", header("Triggers") + triggers);
  await writeTs("post", header("Verbatim leftovers (sequences, grants, unsupported ops)") + post);

  LOG(`✅ Wrote Supabase-style timestamped baseline into ${OUT}`);
  LOG(`ℹ️  You can seed a fixed start time via BASE_TS=YYYYMMDDHHMMSS to keep runs reproducible.`);
})();
