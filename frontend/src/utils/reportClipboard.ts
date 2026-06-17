const EMPTY_CELL = "\u3000";
const MAIN_REPORT_TABLE_WIDTH = "500px";
const OT_REPORT_TABLE_WIDTH = "980px";
const REPORT_CELL_PADDING = "6px";
const REPORT_FONT_FAMILY = "\"Malgun Gothic\", \"맑은 고딕\", sans-serif";
const REPORT_FONT_SIZE = "10pt";
const REPORT_BORDER = "1px solid #222";
const REPORT_FONT_WEIGHT = "normal";

export { EMPTY_CELL };

function stripBoldFromTree(root: ParentNode): void {
  if (root instanceof HTMLElement) {
    root.style.fontWeight = REPORT_FONT_WEIGHT;
  }
  root.querySelectorAll("*").forEach((node) => {
    (node as HTMLElement).style.fontWeight = REPORT_FONT_WEIGHT;
  });
}

function cellPlainText(cell: Element): string {
  return (cell.textContent ?? "").replace(/\t/g, " ").replace(/\n/g, " ").trim();
}

function rowToTsvCells(row: HTMLTableRowElement): string[] {
  const rowData: string[] = [];
  Array.from(row.querySelectorAll("th, td")).forEach((cell) => {
    const colspan = Number.parseInt(cell.getAttribute("colspan") ?? "1", 10);
    rowData.push(cellPlainText(cell));
    for (let index = 1; index < colspan; index += 1) {
      rowData.push("");
    }
  });
  return rowData;
}

export function tableToTsv(table: HTMLTableElement, footerText?: string): string {
  const rows = Array.from(table.querySelectorAll("tr"));
  const body = rows
    .map((row) => rowToTsvCells(row as HTMLTableRowElement).join("\t"))
    .join("\n");
  if (!footerText?.trim()) {
    return body;
  }
  return `${body}\n\n${footerText.trim()}`;
}

export function tableToInlineHtml(table: HTMLTableElement): string {
  const clone = table.cloneNode(true) as HTMLTableElement;
  clone.style.borderCollapse = "collapse";
  clone.style.tableLayout = "fixed";
  clone.style.width = resolveInlineTableWidth(table);
  clone.style.maxWidth = "none";
  clone.style.border = REPORT_BORDER;
  clone.style.background = "#fff";
  clone.style.fontFamily = REPORT_FONT_FAMILY;
  clone.style.fontSize = REPORT_FONT_SIZE;

  clone.querySelectorAll("th, td").forEach((cell) => {
    const el = cell as HTMLElement;
    el.style.border = REPORT_BORDER;
    el.style.padding = REPORT_CELL_PADDING;
    el.style.textAlign =
      el.classList.contains("ot-report-detail") || el.classList.contains("left") ? "left" : "center";
    el.style.whiteSpace = el.classList.contains("ot-report-date") ? "nowrap" : "pre";
    el.style.fontWeight = REPORT_FONT_WEIGHT;
  });

  stripBoldFromTree(clone);
  return clone.outerHTML;
}

function resolveInlineTableWidth(table: HTMLTableElement): string {
  if (table.classList.contains("ot-report-table")) {
    return OT_REPORT_TABLE_WIDTH;
  }
  return MAIN_REPORT_TABLE_WIDTH;
}

function reportContentToPlain(root: HTMLElement): string {
  const parts: string[] = [];

  root.querySelectorAll(".title-line, .worker-line, .report-title-line, .report-worker-line").forEach((node) => {
    const text = node.textContent?.trim();
    if (text) {
      parts.push(text);
    }
  });

  const table = root.querySelector("table");
  if (table) {
    parts.push(tableToTsv(table as HTMLTableElement));
  }

  const remarks = root.querySelector(".remarks, .report-remarks");
  if (remarks) {
    const title = remarks.querySelector(".remarks-title, .report-remarks-title")?.textContent?.trim();
    const lines = Array.from(remarks.querySelectorAll(".remarks-line, .report-remarks-line"))
      .map((line) => line.textContent?.trim())
      .filter((line): line is string => Boolean(line));
    if (title && lines.length > 0) {
      parts.push(`${title}\n${lines.join("\n")}`);
    }
  }

  return parts.join("\n\n");
}

function reportContentToHtml(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement;

  clone.style.fontFamily = REPORT_FONT_FAMILY;
  clone.style.fontSize = REPORT_FONT_SIZE;
  clone.style.color = "#222";
  clone.style.lineHeight = "1.5";

  clone.querySelectorAll(".title-line, .worker-line, .report-title-line, .report-worker-line").forEach((node) => {
    const el = node as HTMLElement;
    el.style.margin = "0 0 8px";
    el.style.fontFamily = REPORT_FONT_FAMILY;
    el.style.fontSize = REPORT_FONT_SIZE;
    el.style.lineHeight = "1.5";
    el.style.color = "#222";
  });

  const table = clone.querySelector("table");
  if (table) {
    const styled = document.createElement("div");
    styled.innerHTML = tableToInlineHtml(table as HTMLTableElement);
    table.replaceWith(styled.firstElementChild ?? styled);
  }

  clone.querySelectorAll(".remarks, .report-remarks").forEach((node) => {
    const el = node as HTMLElement;
    el.style.marginTop = "12px";
    el.style.fontFamily = REPORT_FONT_FAMILY;
    el.style.fontSize = REPORT_FONT_SIZE;
    el.style.color = "#222";
  });

  clone.querySelectorAll(".remarks-title, .remarks-line, .report-remarks-title, .report-remarks-line").forEach((node) => {
    const el = node as HTMLElement;
    el.style.margin = "0 0 4px";
    el.style.padding = "0";
    el.style.fontFamily = REPORT_FONT_FAMILY;
    el.style.fontSize = REPORT_FONT_SIZE;
    el.style.fontWeight = REPORT_FONT_WEIGHT;
  });

  stripBoldFromTree(clone);
  return clone.innerHTML;
}

/** 헤더 문장·근무자·표·비고 전체를 클립보드에 복사 */
export async function copyReport(root: HTMLElement): Promise<void> {
  const plain = reportContentToPlain(root);
  const html = reportContentToHtml(root);
  await writeClipboardPayload(plain, html);
}

export async function copyTable(table: HTMLTableElement, footerText?: string): Promise<void> {
  const tsv = tableToTsv(table, footerText);
  const html = tableToInlineHtml(table);
  await writeClipboardPayload(tsv, html);
}

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const temp = document.createElement("textarea");
  temp.value = text;
  temp.setAttribute("readonly", "");
  temp.style.position = "fixed";
  temp.style.top = "-9999px";
  document.body.appendChild(temp);
  temp.focus();
  temp.select();
  document.execCommand("copy");
  document.body.removeChild(temp);
}

async function writeClipboardPayload(plain: string, html: string): Promise<void> {
  if (navigator.clipboard?.write && window.isSecureContext) {
    const item = new ClipboardItem({
      "text/plain": new Blob([plain], { type: "text/plain" }),
      "text/html": new Blob([html], { type: "text/html" })
    });
    await navigator.clipboard.write([item]);
    return;
  }

  const rich = document.createElement("div");
  rich.contentEditable = "true";
  rich.style.position = "fixed";
  rich.style.left = "-9999px";
  rich.innerHTML = html;
  document.body.appendChild(rich);

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(rich);
  selection?.removeAllRanges();
  selection?.addRange(range);

  const copied = document.execCommand("copy");
  selection?.removeAllRanges();
  document.body.removeChild(rich);

  if (copied) {
    return;
  }

  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(plain);
    return;
  }

  const temp = document.createElement("textarea");
  temp.value = plain;
  temp.setAttribute("readonly", "");
  temp.style.position = "fixed";
  temp.style.top = "-9999px";
  document.body.appendChild(temp);
  temp.focus();
  temp.select();
  document.execCommand("copy");
  document.body.removeChild(temp);
}
