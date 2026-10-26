import type { ReactNode } from "react";
import { usePagination } from "@/hooks/usePagination";
import EmptyState from "../feedback/EmptyState";
import Pagination from "./Pagination";

export interface Column<T> {
  key: string;
  header: string;
  headerClassName?: string;
  mobileLabel?: string;
  mobilePrimary?: boolean;
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
  rowClassName?: (row: T) => string | undefined;
}

/** Client-side paginated table. Server-paginated lists should render their own Pagination. */
export default function DataTable<T>({ columns, rows, rowKey, empty = "Nothing to show.", pageSize = 10, onRowClick, rowClassName }: DataTableProps<T>) {
  const pg = usePagination(rows.length, pageSize);
  if (rows.length === 0) return <EmptyState title={empty} />;
  const slice = rows.slice((pg.page - 1) * pg.pageSize, pg.page * pg.pageSize);
  const mobilePrimaryKey = columns.find((column) => column.mobilePrimary)?.key
    ?? columns.find((column) => column.header && !["cover", "select", "actions"].includes(column.key))?.key
    ?? columns[0]?.key;

  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={[c.headerClassName, c.header ? "" : "table-actions-heading"].filter(Boolean).join(" ") || undefined}>
                  {c.header || c.mobileLabel || "Actions"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((row) => (
              <tr
                key={rowKey(row)}
                className={[onRowClick ? "clickable" : "", rowClassName?.(row)].filter(Boolean).join(" ") || undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={c.className}
                    data-label={c.mobileLabel || c.header || "Actions"}
                    data-primary={mobilePrimaryKey === c.key || undefined}
                    data-status={/^(status|state)$/i.test(c.header) || undefined}
                    data-actions={!c.header || /^actions?$/i.test(c.header) || undefined}
                    data-nowrap={/\b(accession|copy|code|date|due|student\s*(no|number)|shelf|status|condition)\b/i.test(`${c.key} ${c.header}`) || undefined}
                  >
                    {(() => {
                      const content = c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "—");
                      return content === null || content === undefined || content === "" || content === false
                        ? <span className="table-empty">—</span>
                        : content;
                    })()}
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