'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { StandardCaseRow } from '@/types/onboarding'
import { ALL_FIELDS } from '@/lib/onboarding/csv-schema'

interface SpreadsheetEditorProps {
  initialRows?: Partial<StandardCaseRow>[]
  onChange?: (rows: Partial<StandardCaseRow>[]) => void
  disabled?: boolean
  maxRows?: number
}

// 표시할 컬럼 (표준 스키마 전체)
const DISPLAY_COLUMNS = [
  { key: 'court_case_number', label: '사건번호', required: true, width: 140 },
  { key: 'court_name', label: '법원명', required: true, width: 180 },
  { key: 'client_name', label: '의뢰인명', required: true, width: 100 },
  { key: 'case_name', label: '사건명', required: false, width: 150 },
  { key: 'case_type', label: '사건유형', required: false, width: 100 },
  { key: 'opponent_name', label: '상대방', required: false, width: 100 },
  { key: 'assigned_lawyer', label: '담당변호사', required: false, width: 100 },
  { key: 'assigned_staff', label: '담당직원', required: false, width: 100 },
  { key: 'contract_date', label: '계약일', required: false, width: 110 },
  { key: 'retainer_fee', label: '착수금', required: false, width: 100 },
  { key: 'success_fee_agreement', label: '성공보수약정', required: false, width: 120 },
  { key: 'client_phone', label: '의뢰인연락처', required: false, width: 120 },
  { key: 'client_email', label: '의뢰인이메일', required: false, width: 150 },
  { key: 'notes', label: '메모', required: false, width: 200 },
] as const

type ColumnKey = typeof DISPLAY_COLUMNS[number]['key']

export default function SpreadsheetEditor({
  initialRows = [],
  onChange,
  disabled = false,
  maxRows = 100
}: SpreadsheetEditorProps) {
  const [rows, setRows] = useState<Partial<StandardCaseRow>[]>(() => {
    if (initialRows.length > 0) return initialRows
    // 초기 빈 행 5개
    return Array(5).fill(null).map(() => ({}))
  })

  const [selectedCell, setSelectedCell] = useState<{ row: number; col: ColumnKey } | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // 변경 알림
  useEffect(() => {
    if (onChange) {
      // 빈 행 제외
      const nonEmptyRows = rows.filter(row =>
        Object.values(row).some(v => v && String(v).trim())
      )
      onChange(nonEmptyRows)
    }
  }, [rows, onChange])

  // 셀 클릭
  const handleCellClick = useCallback((rowIndex: number, colKey: ColumnKey) => {
    if (disabled) return
    setSelectedCell({ row: rowIndex, col: colKey })
    setEditingValue(String(rows[rowIndex][colKey] || ''))
  }, [disabled, rows])

  // 편집 값 변경
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingValue(e.target.value)
  }, [])

  // 편집 완료
  const commitEdit = useCallback(() => {
    if (!selectedCell) return

    setRows(prev => {
      const newRows = [...prev]
      newRows[selectedCell.row] = {
        ...newRows[selectedCell.row],
        [selectedCell.col]: editingValue.trim() || undefined
      }
      return newRows
    })
  }, [selectedCell, editingValue])

  // 키보드 네비게이션
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!selectedCell) return

    const colKeys = DISPLAY_COLUMNS.map(c => c.key)
    const currentColIndex = colKeys.indexOf(selectedCell.col)

    switch (e.key) {
      case 'Enter':
        e.preventDefault()
        commitEdit()
        // 다음 행으로
        if (selectedCell.row < rows.length - 1) {
          setSelectedCell({ row: selectedCell.row + 1, col: selectedCell.col })
          setEditingValue(String(rows[selectedCell.row + 1][selectedCell.col] || ''))
        }
        break

      case 'Tab':
        e.preventDefault()
        commitEdit()
        // 다음 컬럼으로
        if (currentColIndex < colKeys.length - 1) {
          const nextCol = colKeys[currentColIndex + 1]
          setSelectedCell({ row: selectedCell.row, col: nextCol })
          setEditingValue(String(rows[selectedCell.row][nextCol] || ''))
        } else if (selectedCell.row < rows.length - 1) {
          // 다음 행 첫 컬럼으로
          setSelectedCell({ row: selectedCell.row + 1, col: colKeys[0] })
          setEditingValue(String(rows[selectedCell.row + 1][colKeys[0]] || ''))
        }
        break

      case 'Escape':
        setSelectedCell(null)
        break

      case 'ArrowUp':
        if (selectedCell.row > 0) {
          commitEdit()
          setSelectedCell({ row: selectedCell.row - 1, col: selectedCell.col })
          setEditingValue(String(rows[selectedCell.row - 1][selectedCell.col] || ''))
        }
        break

      case 'ArrowDown':
        if (selectedCell.row < rows.length - 1) {
          commitEdit()
          setSelectedCell({ row: selectedCell.row + 1, col: selectedCell.col })
          setEditingValue(String(rows[selectedCell.row + 1][selectedCell.col] || ''))
        }
        break
    }
  }, [selectedCell, rows, commitEdit])

  // 행 추가
  const addRow = useCallback(() => {
    if (rows.length >= maxRows) {
      alert(`최대 ${maxRows}개까지 입력 가능합니다.`)
      return
    }
    setRows(prev => [...prev, {}])
  }, [rows.length, maxRows])

  // 행 삭제
  const removeRow = useCallback((index: number) => {
    if (rows.length <= 1) return
    setRows(prev => prev.filter((_, i) => i !== index))
    setSelectedCell(null)
  }, [rows.length])

  // 붙여넣기 처리
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (!selectedCell || disabled) return

    e.preventDefault()
    const text = e.clipboardData.getData('text')
    const lines = text.split('\n').filter(line => line.trim())

    if (lines.length === 0) return

    const colKeys = DISPLAY_COLUMNS.map(c => c.key)
    const startColIndex = colKeys.indexOf(selectedCell.col)

    setRows(prev => {
      const newRows = [...prev]

      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const rowIdx = selectedCell.row + lineIdx
        if (rowIdx >= newRows.length) {
          // 행 추가
          if (newRows.length >= maxRows) break
          newRows.push({})
        }

        const values = lines[lineIdx].split('\t')
        for (let valIdx = 0; valIdx < values.length; valIdx++) {
          const colIdx = startColIndex + valIdx
          if (colIdx >= colKeys.length) break

          const colKey = colKeys[colIdx]
          newRows[rowIdx] = {
            ...newRows[rowIdx],
            [colKey]: values[valIdx].trim() || undefined
          }
        }
      }

      return newRows
    })
  }, [selectedCell, disabled, maxRows])

  // 포커스 처리
  useEffect(() => {
    if (selectedCell && inputRef.current) {
      inputRef.current.focus()
    }
  }, [selectedCell])

  return (
    <div className="space-y-4">
      {/* 테이블 */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-10 px-2 py-2 text-center text-xs font-medium text-gray-500">
                  #
                </th>
                {DISPLAY_COLUMNS.map(col => (
                  <th
                    key={col.key}
                    style={{ width: col.width }}
                    className="px-2 py-2 text-left text-xs font-medium text-gray-500"
                  >
                    {col.label}
                    {col.required && <span className="text-red-500 ml-0.5">*</span>}
                  </th>
                ))}
                <th className="w-10 px-2 py-2"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-50">
                  <td className="px-2 py-1 text-center text-xs text-gray-400">
                    {rowIndex + 1}
                  </td>
                  {DISPLAY_COLUMNS.map(col => {
                    const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === col.key
                    const value = row[col.key]

                    return (
                      <td
                        key={col.key}
                        className={`px-1 py-1 ${isSelected ? 'bg-sage-50' : ''}`}
                        onClick={() => handleCellClick(rowIndex, col.key)}
                      >
                        {isSelected ? (
                          <input
                            ref={inputRef}
                            type="text"
                            value={editingValue}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            onBlur={commitEdit}
                            onPaste={handlePaste}
                            className="w-full px-1 py-0.5 text-sm border border-sage-400 rounded
                                       focus:outline-none focus:ring-1 focus:ring-sage-500"
                            disabled={disabled}
                          />
                        ) : (
                          <div
                            className={`px-1 py-0.5 text-sm truncate cursor-pointer
                                       ${value ? 'text-gray-900' : 'text-gray-300'}
                                       ${col.required && !value ? 'bg-red-50' : ''}`}
                          >
                            {value || (col.required ? '필수' : '-')}
                          </div>
                        )}
                      </td>
                    )
                  })}
                  <td className="px-1 py-1">
                    <button
                      type="button"
                      onClick={() => removeRow(rowIndex)}
                      disabled={disabled || rows.length <= 1}
                      className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-30"
                      title="행 삭제"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 하단 버튼 */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={addRow}
          disabled={disabled || rows.length >= maxRows}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-sage-600
                     hover:bg-sage-50 rounded-lg disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          행 추가
        </button>

        <div className="text-xs text-gray-500">
          {rows.length} / {maxRows}행 | Tab: 다음 셀, Enter: 다음 행, Ctrl+V: 붙여넣기
        </div>
      </div>
    </div>
  )
}
