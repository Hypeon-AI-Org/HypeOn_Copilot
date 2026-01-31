"use client";

import React from "react";
import styles from "../../styles/chat.module.css";

type ExportableMarkdownTableProps = React.TableHTMLAttributes<HTMLTableElement> & {
  children?: React.ReactNode;
};

function isElement(node: React.ReactNode): node is React.ReactElement<Record<string, any>> {
  return !!node && typeof node === "object" && "type" in (node as any) && "props" in (node as any);
}

function extractText(node: React.ReactNode): string {
  if (node === null || node === undefined) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isElement(node)) return extractText((node.props as any).children);
  return "";
}

function parseTableChildren(children: React.ReactNode): { headers: string[]; rows: string[][] } {
  const kids = React.Children.toArray(children);

  const findChildByType = (type: string) =>
    kids.find((c) => isElement(c) && typeof c.type === "string" && c.type === type) as
      | React.ReactElement<any>
      | undefined;

  const thead = findChildByType("thead");
  const tbody = findChildByType("tbody");

  const headers: string[] = [];
  if (thead) {
    const tr = React.Children.toArray((thead.props as any).children).find(
      (c) => isElement(c) && typeof c.type === "string" && c.type === "tr"
    ) as React.ReactElement<any> | undefined;

    if (tr) {
      React.Children.toArray((tr.props as any).children).forEach((th) => {
        if (isElement(th) && typeof th.type === "string" && th.type === "th") {
          headers.push(extractText((th.props as any).children).trim());
        }
      });
    }
  }

  const rows: string[][] = [];
  if (tbody) {
    React.Children.toArray((tbody.props as any).children).forEach((trNode) => {
      if (!isElement(trNode) || typeof trNode.type !== "string" || trNode.type !== "tr") return;
      const row: string[] = [];
      React.Children.toArray((trNode.props as any).children).forEach((tdNode) => {
        if (isElement(tdNode) && typeof tdNode.type === "string" && tdNode.type === "td") {
          row.push(extractText((tdNode.props as any).children).trim());
        }
      });
      if (row.length > 0) rows.push(row);
    });
  }

  return { headers, rows };
}

function formatTimestampForFilename(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(
    date.getHours()
  )}-${pad(date.getMinutes())}`;
}

function sanitizeForFilename(name: string) {
  return name
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function sanitizeSheetName(name: string) {
  return (
    name
      .trim()
      .replace(/[\[\]:*?/\\]/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 31) || "Sheet1"
  );
}

export function ExportableMarkdownTable({ children, ...props }: ExportableMarkdownTableProps) {
  const exportToExcel = async () => {
    const XLSX = await import("xlsx");
    const { headers, rows } = parseTableChildren(children);

    const aoa: any[][] = [headers, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeSheetName("Table"));
    XLSX.writeFile(workbook, `${sanitizeForFilename("table")}_${formatTimestampForFilename(new Date())}.xlsx`, {
      compression: true,
    });
  };

  return (
    <div className={styles.dataTableContainer}>
      <div className={styles.tableHeader}>
        <h4 className={styles.tableTitle}>Table</h4>
        <div className={styles.tableActions}>
          <button
            type="button"
            className={styles.exportBtn}
            onClick={exportToExcel}
            aria-label="Download Excel"
            title="Export to Excel"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M12 3v10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M8 11l4 4 4-4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M4 17v3h16v-3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className={styles.tableScroll}>
        <table className={styles.dataTable} {...props}>
          {children}
        </table>
      </div>
    </div>
  );
}
