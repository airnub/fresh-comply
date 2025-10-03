import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parse as parseYaml } from "yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const REPORTS_DIR = path.join(ROOT_DIR, "reports");

type AuditStatus = "ok" | "warning" | "missing" | "error";

type AuditItem = {
  area: string;
  status: AuditStatus;
  summary: string;
  details?: string[];
};

type AuditReport = {
  generatedAt: string;
  reportRoot: string;
  items: AuditItem[];
};

const STATUS_LABELS: Record<AuditStatus, string> = {
  ok: "OK",
  warning: "Warning",
  missing: "Missing",
  error: "Error",
};

const STATUS_ICONS: Record<AuditStatus, string> = {
  ok: "✅",
  warning: "⚠️",
  missing: "❌",
  error: "❌",
};

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function inspectPackageJson(): Promise<AuditItem> {
  const packageJsonPath = path.join(ROOT_DIR, "package.json");

  if (!(await pathExists(packageJsonPath))) {
    return {
      area: "package.json",
      status: "missing",
      summary: "package.json not found at the repository root.",
    };
  }

  try {
    const raw = await fs.readFile(packageJsonPath, "utf8");
    const data = JSON.parse(raw) as Record<string, unknown>;

    const name = typeof data.name === "string" ? data.name : "(unnamed)";
    const version = typeof data.version === "string" ? ` v${data.version}` : "";
    const scripts = isRecord(data.scripts) ? Object.keys(data.scripts) : [];
    const dependencies = isRecord(data.dependencies) ? Object.keys(data.dependencies) : [];
    const devDependencies = isRecord(data.devDependencies) ? Object.keys(data.devDependencies) : [];
    const packageManager = typeof data.packageManager === "string" ? data.packageManager : "(unspecified)";

    return {
      area: "package.json",
      status: "ok",
      summary: `${name}${version} • ${scripts.length} scripts • pnpm via ${packageManager}`,
      details: [
        `Dependencies: ${dependencies.length}`,
        `Dev dependencies: ${devDependencies.length}`,
        scripts.length
          ? `Available scripts: ${truncateList(scripts, 6).join(", ")}${scripts.length > 6 ? "…" : ""}`
          : "No scripts defined.",
      ],
    };
  } catch (error) {
    return {
      area: "package.json",
      status: "error",
      summary: "Failed to parse package.json.",
      details: [String(error)],
    };
  }
}

async function inspectPnpmWorkspace(): Promise<AuditItem> {
  const workspacePath = path.join(ROOT_DIR, "pnpm-workspace.yaml");

  if (!(await pathExists(workspacePath))) {
    return {
      area: "pnpm-workspace.yaml",
      status: "missing",
      summary: "pnpm-workspace.yaml not found.",
    };
  }

  try {
    const raw = await fs.readFile(workspacePath, "utf8");
    const data = parseYaml(raw) as Record<string, unknown>;

    const packageGlobs = Array.isArray(data.packages)
      ? data.packages.filter((value): value is string => typeof value === "string")
      : [];

    return {
      area: "pnpm-workspace.yaml",
      status: "ok",
      summary: `${packageGlobs.length} workspace package patterns detected.`,
      details: packageGlobs.length ? packageGlobs : ["No workspace package globs defined."],
    };
  } catch (error) {
    return {
      area: "pnpm-workspace.yaml",
      status: "error",
      summary: "Failed to parse pnpm-workspace.yaml.",
      details: [String(error)],
    };
  }
}

async function inspectTurboConfig(): Promise<AuditItem> {
  const turboPath = path.join(ROOT_DIR, "turbo.json");

  if (!(await pathExists(turboPath))) {
    return {
      area: "turbo.json",
      status: "missing",
      summary: "turbo.json not found.",
    };
  }

  try {
    const raw = await fs.readFile(turboPath, "utf8");
    const data = JSON.parse(raw) as Record<string, unknown>;
    const tasks = isRecord(data.tasks) ? Object.keys(data.tasks) : [];

    return {
      area: "turbo.json",
      status: "ok",
      summary: `${tasks.length} task pipelines configured.`,
      details: tasks.length ? tasks : ["No tasks defined in turbo.json."],
    };
  } catch (error) {
    return {
      area: "turbo.json",
      status: "error",
      summary: "Failed to parse turbo.json.",
      details: [String(error)],
    };
  }
}

async function inspectAppsDirectory(): Promise<AuditItem> {
  const appsPath = path.join(ROOT_DIR, "apps");

  if (!(await pathExists(appsPath))) {
    return {
      area: "Apps",
      status: "missing",
      summary: "apps/ directory not found.",
    };
  }

  try {
    const entries = await fs.readdir(appsPath, { withFileTypes: true });
    const apps = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));

    const noun = apps.length === 1 ? "app directory" : "app directories";
    return {
      area: "Apps",
      status: apps.length ? "ok" : "warning",
      summary: apps.length ? `${apps.length} ${noun} detected.` : "No app directories detected.",
      details: apps.length ? apps : undefined,
    };
  } catch (error) {
    return {
      area: "Apps",
      status: "error",
      summary: "Failed to inspect apps directory.",
      details: [String(error)],
    };
  }
}

async function inspectConnectors(): Promise<AuditItem> {
  const connectorsPath = path.join(ROOT_DIR, "packages", "connectors");

  if (!(await pathExists(connectorsPath))) {
    return {
      area: "Connectors",
      status: "missing",
      summary: "packages/connectors directory not found.",
    };
  }

  try {
    const srcPath = path.join(connectorsPath, "src");
    if (!(await pathExists(srcPath))) {
      return {
        area: "Connectors",
        status: "warning",
        summary: "Connector package found without a src/ directory.",
      };
    }

    const entries = await fs.readdir(srcPath, { withFileTypes: true });
    const connectorFiles = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".ts") && entry.name !== "index.ts")
      .map((entry) => entry.name.replace(/\.ts$/, ""))
      .sort((a, b) => a.localeCompare(b));

    return {
      area: "Connectors",
      status: connectorFiles.length ? "ok" : "warning",
      summary: connectorFiles.length
        ? `${connectorFiles.length} connector implementation${connectorFiles.length === 1 ? "" : "s"} detected.`
        : "No connector implementations detected in src/.",
      details: connectorFiles.length
        ? connectorFiles
        : ["Consider adding connector implementations under packages/connectors/src."],
    };
  } catch (error) {
    return {
      area: "Connectors",
      status: "error",
      summary: "Failed to inspect connectors package.",
      details: [String(error)],
    };
  }
}

async function inspectDocs(): Promise<AuditItem> {
  const docsPath = path.join(ROOT_DIR, "docs");

  if (!(await pathExists(docsPath))) {
    return {
      area: "Documentation",
      status: "missing",
      summary: "docs/ directory not found.",
    };
  }

  try {
    const entries = await fs.readdir(docsPath, { withFileTypes: true });
    const directories = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
    const files = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));

    return {
      area: "Documentation",
      status: "ok",
      summary: `docs/ contains ${directories.length} subdirectories and ${files.length} root file${files.length === 1 ? "" : "s"}.`,
      details: [
        directories.length
          ? `Subdirectories: ${truncateList(directories, 8).join(", ")}${directories.length > 8 ? "…" : ""}`
          : "No subdirectories at docs/ root.",
        files.length
          ? `Root files: ${truncateList(files, 8).join(", ")}${files.length > 8 ? "…" : ""}`
          : "No files at docs/ root.",
      ],
    };
  } catch (error) {
    return {
      area: "Documentation",
      status: "error",
      summary: "Failed to inspect docs directory.",
      details: [String(error)],
    };
  }
}

async function inspectCiWorkflows(): Promise<AuditItem> {
  const workflowsPath = path.join(ROOT_DIR, ".github", "workflows");

  if (!(await pathExists(workflowsPath))) {
    return {
      area: "CI Workflows",
      status: "missing",
      summary: ".github/workflows directory not found.",
    };
  }

  try {
    const entries = await fs.readdir(workflowsPath, { withFileTypes: true });
    const workflowFiles = entries
      .filter((entry) => entry.isFile() && /\.(yml|yaml)$/i.test(entry.name))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));

    return {
      area: "CI Workflows",
      status: workflowFiles.length ? "ok" : "warning",
      summary: workflowFiles.length
        ? `${workflowFiles.length} GitHub Actions workflow${workflowFiles.length === 1 ? "" : "s"} detected.`
        : "No GitHub Actions workflow files detected.",
      details: workflowFiles.length ? workflowFiles : undefined,
    };
  } catch (error) {
    return {
      area: "CI Workflows",
      status: "error",
      summary: "Failed to inspect CI workflows directory.",
      details: [String(error)],
    };
  }
}

async function inspectAccessibilityTooling(): Promise<AuditItem> {
  const tools: Array<{ name: string; path: string }> = [
    { name: "Pa11y CI configuration", path: path.join(ROOT_DIR, "pa11yci.json") },
    { name: "Contrast checker script", path: path.join(ROOT_DIR, "scripts", "check-contrast.mjs") },
  ];

  const checks = await Promise.all(
    tools.map(async ({ name, path: toolPath }) => ({
      name,
      exists: await pathExists(toolPath),
      relativePath: path.relative(ROOT_DIR, toolPath),
    })),
  );

  const existing = checks.filter((check) => check.exists);
  const missing = checks.filter((check) => !check.exists);

  let status: AuditStatus = "ok";
  if (existing.length === 0) {
    status = "missing";
  } else if (missing.length > 0) {
    status = "warning";
  }

  const details: string[] = [];
  existing.forEach((check) => {
    details.push(`Present: ${check.name} (${check.relativePath})`);
  });
  missing.forEach((check) => {
    details.push(`Missing: ${check.name} (${check.relativePath})`);
  });

  return {
    area: "Accessibility Tooling",
    status,
    summary:
      status === "ok"
        ? "Accessibility tooling configurations detected."
        : status === "missing"
          ? "No accessibility tooling configurations detected."
          : "Partial accessibility tooling coverage detected.",
    details: details.length ? details : undefined,
  };
}

async function inspectDsrRoutes(): Promise<AuditItem> {
  const appsPath = path.join(ROOT_DIR, "apps");

  if (!(await pathExists(appsPath))) {
    return {
      area: "DSR API",
      status: "missing",
      summary: "apps/ directory not found; unable to inspect /api/dsr routes.",
    };
  }

  try {
    const appEntries = await fs.readdir(appsPath, { withFileTypes: true });
    const appDirs = appEntries
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name));

    const dsrRoutes: string[] = [];

    for (const appDir of appDirs) {
      const appName = appDir.name;
      const dsrRoot = path.join(appsPath, appName, "src", "app", "api", "dsr");
      if (!(await pathExists(dsrRoot))) {
        continue;
      }

      const files = (await listFilesRecursive(dsrRoot)).sort((a, b) => a.localeCompare(b));
      if (files.length === 0) {
        dsrRoutes.push(`${appName}: api/dsr (no route files found)`);
      } else {
        files.forEach((file) => {
          dsrRoutes.push(`${appName}: ${path.posix.join("api/dsr", file)}`);
        });
      }
    }

    if (dsrRoutes.length === 0) {
      return {
        area: "DSR API",
        status: "warning",
        summary: "No /api/dsr routes found in app directories.",
      };
    }

    return {
      area: "DSR API",
      status: "ok",
      summary: `${dsrRoutes.length} /api/dsr route file${dsrRoutes.length === 1 ? "" : "s"} detected across apps.`,
      details: dsrRoutes,
    };
  } catch (error) {
    return {
      area: "DSR API",
      status: "error",
      summary: "Failed to inspect /api/dsr routes.",
      details: [String(error)],
    };
  }
}

async function listFilesRecursive(targetPath: string, basePath: string = targetPath): Promise<string[]> {
  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      const childResults = await listFilesRecursive(entryPath, basePath);
      results.push(...childResults);
    } else if (entry.isFile()) {
      const relative = path.relative(basePath, entryPath).split(path.sep).join(path.posix.sep);
      results.push(relative);
    }
  }

  return results;
}

function truncateList(values: string[], limit: number): string[] {
  return values.slice(0, limit);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function buildConsoleTable(items: AuditItem[]): string {
  const header = ["Area", "Status", "Summary"];
  const rows = items.map((item) => [
    item.area,
    `${STATUS_ICONS[item.status]} ${STATUS_LABELS[item.status]}`,
    item.summary,
  ]);

  const tableRows = [header, ...rows];
  const columnWidths = header.map((_, columnIndex) =>
    Math.max(...tableRows.map((row) => row[columnIndex].length)),
  );

  const buildRow = (row: string[]) =>
    `| ${row
      .map((cell, index) => cell.padEnd(columnWidths[index], " "))
      .join(" | ")} |`;

  const separator = `| ${columnWidths.map((width) => "-".repeat(width)).join(" | ")} |`;

  return [buildRow(header), separator, ...rows.map((row) => buildRow(row))].join("\n");
}

function buildMarkdownReport(report: AuditReport): string {
  const lines: string[] = [];
  lines.push("# Repository Audit Report");
  lines.push("");
  lines.push(`Generated at: ${report.generatedAt}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Area | Status | Summary |");
  lines.push("| --- | --- | --- |");

  for (const item of report.items) {
    const area = escapeMarkdownPipes(item.area);
    const status = `${STATUS_ICONS[item.status]} ${STATUS_LABELS[item.status]}`;
    const summary = escapeMarkdownPipes(item.summary);
    lines.push(`| ${area} | ${status} | ${summary} |`);
  }

  lines.push("");
  lines.push("## Details");
  lines.push("");

  for (const item of report.items) {
    lines.push(`### ${escapeMarkdownPipes(item.area)}`);
    lines.push("");
    lines.push(`- **Status:** ${STATUS_ICONS[item.status]} ${STATUS_LABELS[item.status]}`);
    lines.push(`- **Summary:** ${escapeMarkdownPipes(item.summary)}`);
    if (item.details && item.details.length > 0) {
      lines.push("- **Details:**");
      item.details.forEach((detail) => {
        lines.push(`  - ${escapeMarkdownPipes(detail)}`);
      });
    }
    lines.push("");
  }

  return lines.join("\n");
}

function escapeMarkdownPipes(value: string): string {
  return value.replace(/\|/g, "\\|");
}

async function main(): Promise<void> {
  const items = await Promise.all([
    inspectPackageJson(),
    inspectPnpmWorkspace(),
    inspectTurboConfig(),
    inspectAppsDirectory(),
    inspectConnectors(),
    inspectDocs(),
    inspectCiWorkflows(),
    inspectAccessibilityTooling(),
    inspectDsrRoutes(),
  ]);

  const now = new Date();
  const timestamp = now.toISOString();
  const fileSafeTimestamp = timestamp.replace(/[:]/g, "").replace("T", "-").split(".")[0];

  const report: AuditReport = {
    generatedAt: timestamp,
    reportRoot: path.basename(ROOT_DIR),
    items,
  };

  await fs.mkdir(REPORTS_DIR, { recursive: true });

  const jsonPath = path.join(REPORTS_DIR, `audit-${fileSafeTimestamp}.json`);
  const markdownPath = path.join(REPORTS_DIR, `audit-${fileSafeTimestamp}.md`);

  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2), "utf8");
  await fs.writeFile(markdownPath, buildMarkdownReport(report), "utf8");

  console.log(buildConsoleTable(items));
  console.log("");
  console.log("Reports saved to:");
  console.log(`- ${path.relative(ROOT_DIR, jsonPath)}`);
  console.log(`- ${path.relative(ROOT_DIR, markdownPath)}`);
}

main().catch((error) => {
  console.error("Audit script failed.", error);
  process.exitCode = 1;
});
