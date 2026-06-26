import { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  width?: string;
  align?: 'left' | 'right' | 'center';
  numeric?: boolean;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  loading?: boolean;
}

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = 'No records found.',
  loading,
}: Props<T>) {
  return (
    <div className="mx-8 mb-8 bg-white rounded-2xl shadow-card border border-divider overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-cream/60 text-muted">
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ width: col.width }}
                className={[
                  'px-4 py-3 font-medium text-xs uppercase tracking-wider',
                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                ].join(' ')}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-muted">
                Loading…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-muted">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                className="border-t border-divider hover:bg-cream/40 transition"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={[
                      'px-4 py-3 align-middle',
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                      col.numeric ? 'num' : '',
                    ].join(' ')}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
