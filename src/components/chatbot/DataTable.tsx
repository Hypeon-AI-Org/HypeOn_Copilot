"use client";

import React from 'react';
import styles from '../../styles/chat.module.css';
import { TableData } from '@/lib/chatService';

interface DataTableProps {
  table: TableData;
}

export const DataTable: React.FC<DataTableProps> = ({ table }) => {
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
      {/* Title */}
      {table.title && (
        <h4 className={styles.tableTitle}>{table.title}</h4>
      )}
      
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

