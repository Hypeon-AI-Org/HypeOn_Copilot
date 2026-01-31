"use client";

import React from 'react';
import styles from '../../styles/chat.module.css';
import { TableData } from '@/lib/chatService';

interface DataTableProps {
  table: TableData;
}

export const DataTable: React.FC<DataTableProps> = ({ table }) => {
  const formatTimestampForFilename = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`;
  };

  const sanitizeForFilename = (name: string) =>
    name
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '') // windows-illegal + control chars
      .replace(/\s+/g, ' ')
      .slice(0, 80);

  const sanitizeSheetName = (name: string) =>
    name
      .trim()
      .replace(/[\[\]:*?/\\]/g, '') // Excel-illegal
      .replace(/\s+/g, ' ')
      .slice(0, 31) || 'Sheet1';

  // Support both new (columns) and legacy (headers) format
  const headers = table.columns 
    ? table.columns.map(col => col.name)
    : (table.headers || []);

  // Helper function to check if a value is an image URL
  const isImageUrl = (value: string): boolean => {
    if (typeof value !== 'string') return false;
    const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i;
    return imageExtensions.test(value) || value.startsWith('data:image/');
  };

  // Helper function to get column type for a cell
  const getColumnType = (columnIndex: number): string | undefined => {
    if (table.columns && table.columns[columnIndex]) {
      return table.columns[columnIndex].type;
    }
    return undefined;
  };

  const coerceCellForExport = (value: any, columnIndex: number) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (value instanceof Date) return value;

    const columnType = getColumnType(columnIndex);
    const text = String(value).trim();
    if (!text) return '';

    const tryParseNumber = (s: string) => {
      const cleaned = s.replace(/[, ]+/g, '').replace(/^\$/, '');
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : null;
    };

    if (columnType === 'number' || columnType === 'currency') {
      const parsed = tryParseNumber(text);
      return parsed ?? text;
    }

    if (columnType === 'percentage') {
      const pct = text.endsWith('%') ? text.slice(0, -1) : text;
      const parsed = tryParseNumber(pct);
      return parsed ?? text;
    }

    return text;
  };

  const exportToExcel = async () => {
    const XLSX = await import('xlsx');

    const aoa: any[][] = [
      headers,
      ...(Array.isArray(table.rows) ? table.rows : []).map((row: any[]) =>
        (Array.isArray(row) ? row : []).map((cell, idx) => coerceCellForExport(cell, idx))
      ),
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    const workbook = XLSX.utils.book_new();

    const sheetName = sanitizeSheetName(table.title || 'Table');
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const base = sanitizeForFilename(table.title || 'table') || 'table';
    const filename = `${base}_${formatTimestampForFilename(new Date())}.xlsx`;
    XLSX.writeFile(workbook, filename, { compression: true });
  };

  // Helper function to render cell content
  const renderCell = (cell: string, columnIndex: number) => {
    const columnType = getColumnType(columnIndex);
    const cellValue = String(cell ?? "").trim();
    
    // Empty cell - render as empty
    if (!cellValue) {
      return <span style={{ color: '#999' }}>—</span>;
    }
    
    // Check if value is an image URL (regardless of column type)
    const isImage = isImageUrl(cellValue);
    
    // Render image if:
    // 1. Column type is explicitly "image", OR
    // 2. Value looks like an image URL (even if column type is "url")
    if (columnType === "image" || isImage) {
      return (
        <img 
          src={cellValue} 
          alt="Table image" 
          style={{ maxWidth: '100px', maxHeight: '100px', objectFit: 'contain', borderRadius: '4px' }}
          onError={(e) => {
            // Fallback to text if image fails to load
            const target = e.currentTarget;
            target.style.display = 'none';
            const fallback = document.createElement('span');
            fallback.textContent = cellValue;
            fallback.style.color = '#666';
            target.parentNode?.appendChild(fallback);
          }}
        />
      );
    }
    
    // Render URL as clickable link (only if NOT an image)
    if (columnType === "url" || (cellValue.startsWith('http://') || cellValue.startsWith('https://'))) {
      return <a href={cellValue} target="_blank" rel="noopener noreferrer" style={{ color: '#0066cc', textDecoration: 'underline' }}>{cellValue}</a>;
    }
    
    // Default: render as text
    return cellValue;
  };

  return (
    <div className={styles.dataTableContainer}>
      <div className={styles.tableHeader}>
        {table.title ? (
          <h4 className={styles.tableTitle}>{table.title}</h4>
        ) : (
          <div />
        )}

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
      
      {/* Table */}
      <div className={styles.tableScroll}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              {headers.map((header, idx) => (
                <th key={idx}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {row.map((cell, cellIdx) => (
                  <td key={cellIdx}>{renderCell(cell, cellIdx)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Footer */}
      {table.footer && (
        <p className={styles.tableFooter}>{table.footer}</p>
      )}
    </div>
  );
};
