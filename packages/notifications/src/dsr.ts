import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { sendEmail, type EmailMessage } from "./email.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEMPLATE_CACHE: Record<string, string> = {};

function loadTemplate(name: string): string {
  if (!TEMPLATE_CACHE[name]) {
    const filePath = join(__dirname, "email-templates", "dsr", `${name}.hbs`);
    TEMPLATE_CACHE[name] = readFileSync(filePath, "utf8");
  }
  return TEMPLATE_CACHE[name];
}

function renderTemplate(name: string, context: Record<string, string>): string {
  const template = loadTemplate(name);
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => context[key] ?? "");
}

export type AcknowledgementContext = {
  recipientEmail: string;
  recipientName?: string | null;
  requestType: string;
  receivedDate: string;
  requestId: string;
};

export async function sendDsrAcknowledgement(context: AcknowledgementContext) {
  const body = renderTemplate("acknowledgement", {
    recipientName: context.recipientName ?? "there",
    requestType: context.requestType,
    receivedDate: context.receivedDate,
    requestId: context.requestId
  });

  const message: EmailMessage = {
    to: context.recipientEmail,
    subject: `We received your ${context.requestType} request (ref ${context.requestId})`,
    body
  };

  return sendEmail(message);
}

export type BreachEscalationContext = {
  requestId: string;
  tenantOrgName: string;
  requestType: string;
  dueAt: string;
  assigneeEmail?: string | null;
  recipientEmail?: string;
};

export async function sendDsrSlaBreachNotice(context: BreachEscalationContext) {
  const body = renderTemplate("escalation", {
    requestId: context.requestId,
    tenantOrgName: context.tenantOrgName,
    requestType: context.requestType,
    dueAt: context.dueAt,
    assigneeEmail: context.assigneeEmail ?? "unassigned"
  });

  const to = context.recipientEmail ?? "privacy@freshcomply.eu";
  const message: EmailMessage = {
    to,
    subject: `Overdue DSR (${context.requestType}) • ${context.requestId}`,
    body
  };

  return sendEmail(message);
}
