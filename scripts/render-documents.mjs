import { readFile, writeFile, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const [inputArg, outputArg, mode = "guide", pdfArg] = process.argv.slice(2);
if (!inputArg || !outputArg) {
  console.error("Usage: node scripts/render-documents.mjs <input.md> <output.html> [guide|brief] [output.pdf]");
  process.exit(1);
}

const inputPath = resolve(inputArg);
const outputPath = resolve(outputArg);
const lines = (await readFile(inputPath, "utf8"))
  .replaceAll(String.fromCharCode(13), "")
  .split(String.fromCharCode(10));
const css = await readFile(resolve("docs", "document.css"), "utf8");

const escapeHtml = (value) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

function inline(value) {
  let result = escapeHtml(value);
  result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  result = result.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return result;
}

const html = [];
let list = null;
let paragraph = [];
let inCode = false;
let codeLines = [];

function flushParagraph() {
  if (!paragraph.length) return;
  html.push("<p>" + inline(paragraph.join(" ")) + "</p>");
  paragraph = [];
}

function closeList() {
  if (!list) return;
  html.push("</" + list + ">");
  list = null;
}

function flushCode() {
  if (!inCode && !codeLines.length) return;
  html.push("<pre>" + escapeHtml(codeLines.join(String.fromCharCode(10))) + "</pre>");
  codeLines = [];
  inCode = false;
}

for (let index = 0; index < lines.length; index += 1) {
  const line = lines[index];
  if (/^    /.test(line)) {
    flushParagraph();
    closeList();
    inCode = true;
    codeLines.push(line.slice(4));
    continue;
  }
  if (inCode) flushCode();
  if (line === "---PAGE---") {
    flushParagraph();
    closeList();
    html.push(mode === "brief" ? '</section><section class="page">' : '<div class="page-break"></div>');
    continue;
  }
  if (!line.trim()) {
    flushParagraph();
    closeList();
    continue;
  }
  const heading = line.match(/^(#{1,3})\s+(.+)$/);
  if (heading) {
    flushParagraph();
    closeList();
    const level = heading[1].length;
    html.push("<h" + level + ">" + inline(heading[2]) + "</h" + level + ">");
    continue;
  }
  if (line.startsWith("> ")) {
    flushParagraph();
    closeList();
    html.push("<blockquote>" + inline(line.slice(2)) + "</blockquote>");
    continue;
  }
  const unordered = line.match(/^[-*]\s+(.+)$/);
  const ordered = line.match(/^\d+\.\s+(.+)$/);
  if (unordered || ordered) {
    flushParagraph();
    const nextList = ordered ? "ol" : "ul";
    if (list !== nextList) {
      closeList();
      html.push("<" + nextList + ">");
      list = nextList;
    }
    html.push("<li>" + inline((unordered || ordered)[1]) + "</li>");
    continue;
  }
  if (line.startsWith("|") && lines[index + 1]?.match(/^\|?[\s:|-]+\|$/)) {
    flushParagraph();
    closeList();
    const rows = [];
    while (index < lines.length && lines[index].startsWith("|")) {
      rows.push(lines[index].split("|").slice(1, -1).map((cell) => cell.trim()));
      index += 1;
    }
    index -= 1;
    const headers = rows[0];
    const body = rows.slice(2);
    html.push("<table><thead><tr>" + headers.map((cell) => "<th>" + inline(cell) + "</th>").join("") + "</tr></thead><tbody>");
    for (const row of body) {
      html.push("<tr>" + row.map((cell) => "<td>" + inline(cell) + "</td>").join("") + "</tr>");
    }
    html.push("</tbody></table>");
    continue;
  }
  if (/^!\[/.test(line)) {
    flushParagraph();
    closeList();
    html.push(inline(line));
    continue;
  }
  paragraph.push(line.trim());
}
flushParagraph();
closeList();
flushCode();

const body = mode === "brief"
  ? '<body class="brief"><section class="page cover">' + html.join(String.fromCharCode(10)) + "</section></body>"
  : '<body class="guide">' + html.join(String.fromCharCode(10)) + "</body>";
const printOverride = mode === "brief" ? "@page { size: A4; margin: 0; }" : "";
const documentHtml = '<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>WareSim AI</title><style>' + css + printOverride + "</style></head>" + body + "</html>";
await writeFile(outputPath, documentHtml, "utf8");
console.log("HTML generated:", outputPath);

if (mode === "brief" && pdfArg) {
  const pdfPath = resolve(pdfArg);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(pathToFileURL(outputPath).href, { waitUntil: "load" });
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  await browser.close();
  await copyFile(pdfPath, resolve(".", "..", "WARESIM_AI_TOM_TAT_GUI_CHUYEN_GIA.pdf"));
  console.log("PDF generated:", pdfPath);
}
