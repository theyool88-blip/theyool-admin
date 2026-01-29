'use client'

import { ReactNode } from 'react'
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

export type SortDirection = 'asc' | 'desc' | null

export interface Column<T> {
  key: string
  header: string
  width?: string
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  render?: (item: T, index: number) => ReactNode
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  keyExtractor: (item: T) => string
  onRowClick?: (item: T) => void
  sortColumn?: string
  sortDirection?: SortDirection
  onSort?: (column: string, direction: SortDirection) => void
  isLoading?: boolean
  emptyMessage?: string
  rowActions?: (item: T) => ReactNode
  selectedRows?: Set<string>
  onRowSelect?: (id: string, selected: boolean) => void
  onSelectAll?: (selected: boolean) => void
  showCheckbox?: boolean
  className?: string
}

export default function DataTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  sortColumn,
  sortDirection,
  onSort,
  isLoading = false,
  emptyMessage = '데이터가 없습니다',
  rowActions,
  selectedRows,
  onRowSelect,
  onSelectAll,
  showCheckbox = false,
  className = '',
}: DataTableProps<T>) {
  const handleSort = (column: string) => {
    if (!onSort) return

    let newDirection: SortDirection = 'asc'
    if (sortColumn === column) {
      if (sortDirection === 'asc') newDirection = 'desc'
      else if (sortDirection === 'desc') newDirection = null
    }
    onSort(column, newDirection)
  }

  const allSelected = selectedRows && data.length > 0 && data.every((item) => selectedRows.has(keyExtractor(item)))
  const someSelected = selectedRows && data.some((item) => selectedRows.has(keyExtractor(item)))

  return (
    <div className={`bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-xl overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              {showCheckbox && (
                <th className="w-12 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = Boolean(someSelected && !allSelected)
                    }}
                    onChange={(e) => onSelectAll?.(e.target.checked)}
                    className="w-4 h-4 rounded border-[var(--border-default)] text-[var(--sage-primary)] focus:ring-[var(--sage-primary)]"
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`${column.sortable ? 'sortable' : ''}`}
                  style={{ width: column.width, textAlign: column.align || 'left' }}
                  onClick={column.sortable ? () => handleSort(column.key) : undefined}
                >
                  <div className="flex items-center gap-1">
                    <span>{column.header}</span>
                    {column.sortable && sortColumn === column.key && (
                      sortDirection === 'asc' ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : sortDirection === 'desc' ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : null
                    )}
                  </div>
                </th>
              ))}
              {rowActions && <th className="w-12"></th>}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length + (showCheckbox ? 1 : 0) + (rowActions ? 1 : 0)}>
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-[var(--border-default)] border-t-[var(--sage-primary)]"></div>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (showCheckbox ? 1 : 0) + (rowActions ? 1 : 0)}>
                  <div className="py-12 text-center text-caption">
                    {emptyMessage}
                  </div>
                </td>
              </tr>
            ) : (
              data.map((item, index) => {
                const id = keyExtractor(item)
                const isSelected = selectedRows?.has(id)

                return (
                  <tr
                    key={id}
                    onClick={() => onRowClick?.(item)}
                    className={`${onRowClick ? 'cursor-pointer' : ''} ${isSelected ? 'bg-[var(--sage-muted)]' : ''}`}
                  >
                    {showCheckbox && (
                      <td className="text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => onRowSelect?.(id, e.target.checked)}
                          className="w-4 h-4 rounded border-[var(--border-default)] text-[var(--sage-primary)] focus:ring-[var(--sage-primary)]"
                        />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        style={{ textAlign: column.align || 'left' }}
                      >
                        {column.render
                          ? column.render(item, index)
                          : String((item as Record<string, unknown>)[column.key] ?? '')}
                      </td>
                    ))}
                    {rowActions && (
                      <td className="text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="data-table-row-actions justify-center">
                          {rowActions(item)}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Pagination component
interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
  onPageChange: (page: number) => void
  onItemsPerPageChange?: (itemsPerPage: number) => void
  itemsPerPageOptions?: number[]
  className?: string
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  itemsPerPageOptions = [25, 50, 100],
  className = '',
}: PaginationProps) {
  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = []
    const delta = 2

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - delta && i <= currentPage + delta)
      ) {
        pages.push(i)
      } else if (pages[pages.length - 1] !== 'ellipsis') {
        pages.push('ellipsis')
      }
    }

    return pages
  }

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t border-[var(--border-default)] ${className}`}>
      <div className="text-caption">
        {startItem}-{endItem} / {totalItems}건
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="btn btn-ghost btn-sm"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {getPageNumbers().map((page, index) =>
          page === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="px-2 text-[var(--text-muted)]">
              ...
            </span>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              className={`btn btn-sm ${
                currentPage === page
                  ? 'btn-primary'
                  : 'btn-ghost'
              }`}
            >
              {page}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="btn btn-ghost btn-sm"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {onItemsPerPageChange && (
        <div className="flex items-center gap-2">
          <span className="text-caption">페이지당:</span>
          <select
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
            className="form-input h-8 px-2 py-1 text-caption"
          >
            {itemsPerPageOptions.map((option) => (
              <option key={option} value={option}>
                {option}건
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

// Table toolbar
interface TableToolbarProps {
  children: ReactNode
  className?: string
}

export function TableToolbar({ children, className = '' }: TableToolbarProps) {
  return (
    <div className={`flex flex-wrap items-center gap-3 mb-4 ${className}`}>
      {children}
    </div>
  )
}

// Table action button (for row actions)
interface TableActionButtonProps {
  onClick: () => void
  label: string
  variant?: 'default' | 'primary' | 'danger'
  className?: string
}

export function TableActionButton({
  onClick,
  label,
  variant = 'default',
  className = '',
}: TableActionButtonProps) {
  const variantClass = {
    default: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
    primary: 'bg-[var(--sage-primary)] text-white hover:bg-[var(--sage-primary-hover)]',
    danger: 'bg-[var(--color-danger)] text-white hover:bg-[#DC2626]',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-1 text-xs font-medium rounded transition-colors ${variantClass[variant]} ${className}`}
    >
      {label}
    </button>
  )
}
