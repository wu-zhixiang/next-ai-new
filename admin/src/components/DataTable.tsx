import type { ReactNode } from 'react';

export interface DataTableColumn<T> {
  readonly id: string;
  readonly header: string;
  readonly cell: (row: T) => ReactNode;
  readonly align?: 'left' | 'center' | 'right';
  readonly width?: string;
}

interface DataTableProps<T> {
  readonly columns: readonly DataTableColumn<T>[];
  readonly rows: readonly T[];
  readonly getRowKey: (row: T) => string;
  readonly emptyText?: string;
}

export function DataTable<T>({
  columns,
  emptyText = '暂无数据',
  getRowKey,
  rows,
}: DataTableProps<T>): JSX.Element {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.id}
                style={column.width ? { width: column.width } : undefined}
                className={column.align ? `is-${column.align}` : undefined}
                scope="col"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length > 0 ? rows.map((row) => (
            <tr key={getRowKey(row)}>
              {columns.map((column) => (
                <td key={column.id} className={column.align ? `is-${column.align}` : undefined}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          )) : (
            <tr>
              <td className="table-empty" colSpan={columns.length}>
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
