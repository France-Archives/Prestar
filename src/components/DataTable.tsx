import type { ReactNode } from "react";
import { usePaged } from "../hooks/usePaged";
import Pager from "./Pager";

export type Column<T> = { key: string; label: string; render?: (row: T) => ReactNode };

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey?: string; // name of a unique field on each row
  empty?: string;
  pageSize?: number;
  onRowClick?: (row: T) => void;
};

const cell = (row: object, key: string) => String((row as Record<string, unknown>)[key] ?? "");

export default function DataTable<T extends object>({ columns, rows, rowKey = "id", empty = "Nothing to show.", pageSize = 10, onRowClick }: DataTableProps<T>) {
  const { page, pages, setPage, slice } = usePaged(rows, pageSize);
  if (!rows.length) return <div className="empty"><p>{empty}</p></div>;
  return (
    <>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {slice.map((r) => (
              <tr key={cell(r, rowKey)} className={onRowClick ? "click" : ""} onClick={onRowClick ? () => onRowClick(r) : undefined}>
                {columns.map((c) => <td key={c.key}>{c.render ? c.render(r) : cell(r, c.key)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} pages={pages} onChange={setPage} />
    </>
  );
}