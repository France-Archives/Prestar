import type { ReactNode } from "react";
import { usePagination } from "@/hooks/usePagination";
import EmptyState from "../feedback/EmptyState";
import Pagination from "./Pagination";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: string;
  pageSize?: number;
  onRowClick?: (row: T) => void;
}

/** Client-side paginated table. Server-paginated lists should render their own Pagination. */
export default function DataTable<T>({ columns, rows, rowKey, empty = "Nothing to show.", pageSize = 10, onRowClick }: DataTableProps<T>) {
  const pg = usePagination(rows.length, pageSize);
  if (rows.length === 0) return <EmptyState title={empty} />;
  const slice = rows.slice((pg.page - 1) * pg.pageSize, pg.page * pg.pageSize);

  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={c.className}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((row) => (
              <tr
                key={rowKey(row)}
                className={onRowClick ? "clickable" : ""}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((c) => (
                  <td key={c.key} className={c.className}>
                    {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination
        page={pg.page}
        totalPages={pg.totalPages}
        from={pg.from}
        to={pg.to}
        total={rows.length}
        onPrev={pg.prev}
        onNext={pg.next}
      />
    </>
  );
}