"use client";

import { useState } from "react";

interface Column<T> {
  key: string;
  header: string;
  render: (row: T, index: number) => React.ReactNode;
  className?: string;
}

interface CardTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string;
  emptyMessage?: string;
  className?: string;
}

function MobileCardRow<T>({
  row,
  rowIndex,
  columns,
  isExpanded,
  onToggle,
}: {
  row: T;
  rowIndex: number;
  columns: Column<T>[];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 p-4 text-left focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 rounded-lg"
        aria-expanded={isExpanded}
      >
        <div className="flex-1 min-w-0">
          {columns.slice(0, 3).map((col, i) => (
            <div key={`${col.key}-preview`} className={i > 0 ? "mt-1" : ""}>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{col.header}</span>
              <span className="text-sm font-semibold text-slate-900 truncate block">{col.render(row, rowIndex)}</span>
            </div>
          ))}
          {columns.length > 3 && (
            <span className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500">
              <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {columns.length - 3} more fields
            </span>
          )}
        </div>
        <svg
          className={`size-5 text-slate-400 transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="border-t border-slate-100 bg-slate-50/50 rounded-b-lg p-4 space-y-3 animate-in slide-in-from-top-2 duration-150">
          {columns.slice(3).map((col) => (
            <div key={col.key} className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{col.header}</span>
              <span className="text-sm font-semibold text-slate-900">{col.render(row, rowIndex)}</span>
            </div>
          ))}
          {columns.length <= 3 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {columns.slice(0, 3).map((col) => (
                <div key={col.key} className="flex flex-col gap-1 flex-1 min-w-[140px]">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{col.header}</span>
                  <span className="text-sm font-semibold text-slate-900">{col.render(row, rowIndex)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export function CardTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = "No data available",
  className = "",
}: CardTableProps<T>) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isExpanded = (key: string) => expandedRows.has(key);

  if (data.length === 0) {
    return (
      <div className="rounded-lg bg-slate-50 p-8 text-center text-slate-600">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[800px] border-collapse text-left text-sm">
          <thead className="bg-slate-950 text-white">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`p-3 ${col.className ?? ""}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr key={keyExtractor(row, rowIndex)} className="border-b border-slate-200 hover:bg-slate-50">
                {columns.map((col) => (
                  <td key={col.key} className={`p-3 ${col.className ?? ""}`}>
                    {col.render(row, rowIndex)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3">
        {data.map((row, rowIndex) => {
          const key = keyExtractor(row, rowIndex);
          return (
            <MobileCardRow
              key={key}
              row={row}
              rowIndex={rowIndex}
              columns={columns}
              isExpanded={isExpanded(key)}
              onToggle={() => toggleRow(key)}
            />
          );
        })}
      </div>
    </div>
  );
}
