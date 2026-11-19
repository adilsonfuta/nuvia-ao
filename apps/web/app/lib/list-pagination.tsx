"use client";

import { useEffect } from "react";
import { useState } from "react";
import type { ReactNode } from "react";

export const LIST_PAGE_SIZES = [5, 10, 20, 50, 100] as const;

export function slicePage<T>(items: T[], page: number, pageSize: number) {
  const safePage = Math.min(page, Math.max(1, Math.ceil(items.length / pageSize)));
  return items.slice((safePage - 1) * pageSize, safePage * pageSize);
}

export function useListPage<T>(items: T[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, pageCount);
  return { pageCount, pageItems: slicePage(items, safePage, pageSize) };
}

export function ListPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  label = "itens",
  sizes = LIST_PAGE_SIZES,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  label?: string;
  sizes?: readonly number[];
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  useEffect(() => {
    if (page !== safePage) onPageChange(safePage);
  }, [page, safePage, onPageChange]);
  if (!total) return null;
  const first = (safePage - 1) * pageSize + 1;
  const last = Math.min(safePage * pageSize, total);
  return (
    <nav className="list-pagination" aria-label={`Paginação: ${label}`}>
      <label className="list-pagination-size">
        <span>Mostrar</span>
        <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} aria-label={`Quantidade de ${label} por página`}>
          {sizes.map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
        <span>por página</span>
      </label>
      <span className="list-pagination-range">{first}–{last} de {total} {label}</span>
      <div className="list-pagination-actions">
        <button type="button" disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)}>Anterior</button>
        <span>Página {safePage} de {totalPages}</span>
        <button type="button" disabled={safePage >= totalPages} onClick={() => onPageChange(safePage + 1)}>Seguinte</button>
      </div>
    </nav>
  );
}

export function PaginatedList<T>({
  items,
  label,
  className,
  children,
}: {
  items: T[];
  label: string;
  className?: string;
  children: (item: T, index: number) => ReactNode;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { pageItems } = useListPage(items, page, pageSize);
  const safePage = Math.min(page, Math.max(1, Math.ceil(items.length / pageSize)));
  const renderedItems = pageItems.map((item, index) => children(item, (safePage - 1) * pageSize + index));
  return <>{className ? <div className={className}>{renderedItems}</div> : renderedItems}<ListPagination page={safePage} pageSize={pageSize} total={items.length} label={label} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} /></>;
}
