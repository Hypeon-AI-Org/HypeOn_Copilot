"use client";

import React from 'react';
import styles from '../../styles/chat.module.css';
import { TableData, ColumnMetadata } from '@/lib/chatService';

interface DataTableProps {
  table: TableData;
}

// Helper function for type-aware formatting
function formatCell(value: string, colMeta: ColumnMetadata | null): string {
  if (!colMeta) return value;
  
  switch (colMeta.type) {
    case "currency":
      const num = parseFloat(value);
      if (isNaN(num)) return value;
      const unit = colMeta.unit || "USD";
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: unit === 'USD' ? 'USD' : unit,
      }).format(num);
    
    case "percentage":
      const pct = parseFloat(value);
      if (isNaN(pct)) return value;
      return `${pct.toFixed(1)}%`;
    
    case "number":
      const numVal = parseFloat(value);
      if (isNaN(numVal)) return value;
      if (colMeta.format) {
        // Simple format support (e.g., "0.2f" for 2 decimals)
        const decimals = parseInt(colMeta.format.match(/\d+/)?.[0] || '0');
        return numVal.toFixed(decimals);
      }
      return numVal.toString();
    
    case "date":
    case "datetime":
      try {
        const date = new Date(value);
        if (isNaN(date.getTime())) return value;
        return date.toLocaleDateString();
      } catch {
        return value;
      }
    
    default:
      return value;
  }
}

export const DataTable: React.FC<DataTableProps> = ({ table }) => {
  // Support both new (columns) and legacy (headers) format
  const headers = table.columns 
    ? table.columns.map(col => col.name)
    : (table.headers || []);
  
  // Get column metadata for better rendering
  const getColumnMetadata = (index: number): ColumnMetadata | null => {
    if (table.columns && table.columns[index]) {
      return table.columns[index];
    }
    return null;
  };

  return (
    <div className={styles.dataTableContainer}>
      {/* Title */}
      {table.title && (
        <h4 className={styles.tableTitle}>{table.title}</h4>
      )}
      
      {/* Description */}
      {table.description && (
        <p className={styles.tableDescription}>{table.description}</p>
      )}
      
      {/* Table */}
      <div className={styles.tableScroll}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              {headers.map((header, idx) => {
                const colMeta = getColumnMetadata(idx);
                return (
                  <th 
                    key={idx}
                    data-type={colMeta?.type}
                    data-unit={colMeta?.unit}
                  >
                    {header}
                    {colMeta?.unit && (
                      <span className={styles.unit}> ({colMeta.unit})</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {row.map((cell, cellIdx) => {
                  const colMeta = getColumnMetadata(cellIdx);
                  const formattedCell = formatCell(cell, colMeta);
                  return (
                    <td 
                      key={cellIdx}
                      data-type={colMeta?.type}
                    >
                      {formattedCell}
                    </td>
                  );
                })}
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

