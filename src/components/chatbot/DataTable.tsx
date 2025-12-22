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
                  <td key={cellIdx}>{cell}</td>
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

