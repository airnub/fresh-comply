import fs from "node:fs";
import path from "node:path";
import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";

export type RenderedDocument = {
  filename: string;
  content: string;
  checksum: string;
  pdfBase64: string;
};

function checksumFor(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i += 1) {
    hash = (hash << 5) - hash + content.charCodeAt(i);
    hash |= 0;
  }
  return `demo-${Math.abs(hash)}`;
}

export function renderBoardMinutes(context: Record<string, unknown>): RenderedDocument {
  const templateDir = path.dirname(fileURLToPath(import.meta.url));
  const templatePath = path.resolve(templateDir, "../templates/board_minutes_a1.hbs");
  const raw = fs.readFileSync(templatePath, "utf8");
  const compiled = Handlebars.compile(raw);
  const content = compiled(context);
  const pdfBase64 = createPdfFromText(content);
  return { filename: "board_minutes_a1.md", content, checksum: checksumFor(content), pdfBase64 };
}

function createPdfFromText(text: string): string {
  const header = "%PDF-1.4\n";
  let body = "";
  const offsets: number[] = [0];

  const addObject = (obj: string) => {
    offsets.push(header.length + body.length);
    body += obj;
  };

  addObject("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  addObject("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  addObject(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
  );

  const lines = text.split("\n");
  const segments = lines.map((line, index) => {
    const safe = escapePdfText(line || " ");
    if (index === 0) {
      return `(${safe}) Tj`;
    }
    return `T* (${safe}) Tj`;
  });
  const streamContent = `BT /F1 12 Tf 72 720 Td\n${segments.join("\n")}\nET`;
  const streamLength = Buffer.byteLength(streamContent, "utf8");
  addObject(`4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`);

  addObject("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

  const startXref = header.length + body.length;
  let xref = `xref\n0 ${offsets.length}\n`;
  xref += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) {
    xref += `${offsets[i].toString().padStart(10, "0")} 00000 n \n`;
  }
  xref += "trailer\n";
  xref += "<< /Size " + offsets.length + " /Root 1 0 R >>\n";
  xref += "startxref\n" + startXref + "\n%%EOF";

  const pdf = header + body + xref;
  return Buffer.from(pdf, "utf8").toString("base64");
}

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
