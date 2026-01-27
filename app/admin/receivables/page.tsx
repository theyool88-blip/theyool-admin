'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatCurrency } from '@/types/payment'

type ReceivableGrade = 'normal' | 'watch' | 'collection'

interface Memo {
  id: string
  content: string
  is_completed: boolean
  created_at: string
  completed_at: string | null
}

interface CaseReceivable {
  id: string
  case_name: string
  case_type: string
  office: string
  outstanding: number
  grade: ReceivableGrade
}

interface ClientReceivable {
  client_id: string
  client_name: string
  case_count: number
  outstanding: number
  highest_grade: ReceivableGrade
  cases: CaseReceivable[]
  memos?: Memo[]
}

interface WriteOff {
  id: string
  case_id: string
  case_name: string
  client_name: string | null
  original_amount: number
  reason: string | null
  written_off_at: string
}

interface ReceivablesSummary {
  total_outstanding: number
  pyeongtaek_outstanding: number
  cheonan_outstanding: number
  client_count: number
  case_count: number
  watch_count: number
  collection_count: number
  clients: ClientReceivable[]
  writeoffs?: WriteOff[]
}

interface WaiveModalState {
  isOpen: boolean
  caseId: string
  caseName: string
  amount: number
}

const gradeLabels: Record<ReceivableGrade, string> = {
  normal: '정상',
  watch: '관리',
  collection: '추심',
}

export default function ReceivablesPage() {
  const [data, setData] = useState<ReceivablesSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'active' | 'writeoffs'>('active')

  const [officeFilter, setOfficeFilter] = useState<string>('')
  const [sortBy, setSortBy] = useState<string>('outstanding')
  const [gradeFilter, setGradeFilter] = useState<string>('')

  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set())

  const [waiveModal, setWaiveModal] = useState<WaiveModalState>({
    isOpen: false, caseId: '', caseName: '', amount: 0
  })
  const [waiveReason, setWaiveReason] = useState('')
  const [waiving, setWaiving] = useState(false)

  const [newMemoContent, setNewMemoContent] = useState<Record<string, string>>({})

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (officeFilter) params.append('office', officeFilter)
      if (sortBy) params.append('sort_by', sortBy)
      params.append('sort_order', 'desc')
      if (gradeFilter) params.append('grade', gradeFilter)
      params.append('include_writeoffs', 'true')

      const res = await fetch(`/api/admin/receivables?${params}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : '조회 실패')
    } finally {
      setLoading(false)
    }
  }, [officeFilter, sortBy, gradeFilter])

  useEffect(() => { fetchData() }, [fetchData])

  const toggleExpand = (id: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const openWaiveModal = (caseId: string, caseName: string, amount: number) => {
    setWaiveModal({ isOpen: true, caseId, caseName, amount })
    setWaiveReason('')
  }

  const closeWaiveModal = () => {
    setWaiveModal({ isOpen: false, caseId: '', caseName: '', amount: 0 })
  }

  const handleWaive = async () => {
    if (!waiveReason.trim()) return alert('포기 사유를 입력해주세요.')
    setWaiving(true)
    try {
      const res = await fetch('/api/admin/receivables', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: waiveModal.caseId, reason: waiveReason.trim() })
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      closeWaiveModal()
      fetchData()
    } catch (err) {
      alert(err instanceof Error ? err.message : '처리 실패')
    } finally {
      setWaiving(false)
    }
  }

  const changeGrade = async (caseId: string, grade: ReceivableGrade) => {
    try {
      const res = await fetch('/api/admin/receivables', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId, grade })
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      fetchData()
    } catch { alert('등급 변경 실패') }
  }

  const addMemo = async (clientId: string) => {
    const content = newMemoContent[clientId]?.trim()
    if (!content) return
    try {
      const res = await fetch('/api/admin/receivables/memos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, content })
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setNewMemoContent(prev => ({ ...prev, [clientId]: '' }))
      fetchData()
    } catch { alert('메모 추가 실패') }
  }

  const toggleMemo = async (memoId: string, isCompleted: boolean) => {
    try {
      await fetch('/api/admin/receivables/memos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: memoId, is_completed: !isCompleted })
      })
      fetchData()
    } catch {}
  }

  const deleteMemo = async (memoId: string) => {
    if (!confirm('삭제하시겠습니까?')) return
    try {
      await fetch(`/api/admin/receivables/memos?id=${memoId}`, { method: 'DELETE' })
      fetchData()
    } catch {}
  }

  const fmtDate = (d: string) => {
    const date = new Date(d)
    const yy = String(date.getFullYear()).slice(2)
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return `${yy}.${mm}.${dd}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--border-default)] border-t-[var(--text-secondary)]"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-5xl mx-auto pt-6 pb-8 px-4">
        {/* Summary */}
        {data && (
          <div className="flex items-center gap-6 mb-5 text-sm">
            <div>
              <span className="text-[var(--text-tertiary)]">총 미수금</span>
              <span className="ml-2 text-lg font-medium text-[var(--text-primary)]">{formatCurrency(data.total_outstanding)}</span>
            </div>
            <div className="text-[var(--text-muted)]">|</div>
            <div className="text-[var(--text-tertiary)]">
              {data.client_count}명 · {data.case_count}건
            </div>
            {data.watch_count > 0 && (
              <span className="px-2 py-0.5 text-xs bg-[var(--color-warning-muted)] text-[var(--color-warning)] rounded">관리 {data.watch_count}</span>
            )}
            {data.collection_count > 0 && (
              <span className="px-2 py-0.5 text-xs bg-[var(--color-danger-muted)] text-[var(--color-danger)] rounded">추심 {data.collection_count}</span>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4 text-sm">
          <div className="flex bg-[var(--bg-tertiary)] rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-3 py-1 rounded-md ${activeTab === 'active' ? 'bg-[var(--bg-secondary)] shadow-sm font-medium' : 'text-[var(--text-tertiary)]'}`}
            >
              미수금
            </button>
            <button
              onClick={() => setActiveTab('writeoffs')}
              className={`px-3 py-1 rounded-md ${activeTab === 'writeoffs' ? 'bg-[var(--bg-secondary)] shadow-sm font-medium' : 'text-[var(--text-tertiary)]'}`}
            >
              포기이력 {data?.writeoffs?.length ? `(${data.writeoffs.length})` : ''}
            </button>
          </div>

          {activeTab === 'active' && (
            <>
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="form-input px-2 py-1 text-sm"
              >
                <option value="">전체등급</option>
                <option value="normal">정상</option>
                <option value="watch">관리</option>
                <option value="collection">추심</option>
              </select>

              <select
                value={officeFilter}
                onChange={(e) => setOfficeFilter(e.target.value)}
                className="form-input px-2 py-1 text-sm"
              >
                <option value="">전체사무소</option>
                <option value="평택">평택</option>
                <option value="천안">천안</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="form-input px-2 py-1 text-sm"
              >
                <option value="outstanding">미수금순</option>
                <option value="grade">등급순</option>
                <option value="name">이름순</option>
              </select>
            </>
          )}
        </div>

        {error && <div className="text-sm text-[var(--color-danger)] mb-4">{error}</div>}

        {/* List */}
        {activeTab === 'active' && (
          <div className="card">
            {!data?.clients.length ? (
              <div className="py-12 text-center text-[var(--text-muted)]">미수금 없음</div>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)]">
                {data.clients.map((client) => {
                  const isOpen = expandedClients.has(client.client_id)
                  const memos = client.memos || []

                  return (
                    <div key={client.client_id}>
                      {/* Client Row */}
                      <div
                        onClick={() => toggleExpand(client.client_id)}
                        className="flex items-center px-4 py-3 hover:bg-[var(--bg-hover)] cursor-pointer"
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium mr-3 ${
                          client.highest_grade === 'collection' ? 'bg-[var(--color-danger-muted)] text-[var(--color-danger)]' :
                          client.highest_grade === 'watch' ? 'bg-[var(--color-warning-muted)] text-[var(--color-warning)]' :
                          'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                        }`}>
                          {client.client_name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-[var(--text-primary)] text-sm">{client.client_name}</span>
                            <span className="text-xs text-[var(--text-muted)]">{client.case_count}건</span>
                          </div>
                          {memos.length > 0 && (
                            <p className="text-[14px] text-[var(--text-tertiary)] mt-0.5 truncate">
                              {memos[0].content}
                            </p>
                          )}
                        </div>
                        <span className="font-medium text-[var(--text-primary)] text-sm">{formatCurrency(client.outstanding)}</span>
                        <svg className={`w-4 h-4 ml-2 text-[var(--text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>

                      {/* Expanded */}
                      {isOpen && (
                        <div className="bg-[var(--bg-primary)] border-t border-[var(--border-subtle)]">
                          {/* Cases */}
                          {client.cases.map((c) => (
                            <div key={c.id} className="flex items-center px-4 py-2 pl-14 border-b border-[var(--border-subtle)] last:border-b-0 bg-[var(--bg-secondary)]">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-[var(--text-primary)]">{c.case_name}</span>
                                  {c.grade !== 'normal' && (
                                    <span className={`px-1.5 py-0.5 text-xs rounded ${c.grade === 'watch' ? 'bg-[var(--color-warning-muted)] text-[var(--color-warning)]' : 'bg-[var(--color-danger-muted)] text-[var(--color-danger)]'}`}>
                                      {gradeLabels[c.grade]}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="text-sm font-medium text-[var(--text-primary)] mr-3">{formatCurrency(c.outstanding)}</span>
                              <select
                                value={c.grade}
                                onChange={(e) => changeGrade(c.id, e.target.value as ReceivableGrade)}
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs px-1.5 py-0.5 border border-[var(--border-default)] rounded mr-2 bg-[var(--bg-secondary)]"
                              >
                                <option value="normal">정상</option>
                                <option value="watch">관리</option>
                                <option value="collection">추심</option>
                              </select>
                              <button
                                onClick={(e) => { e.stopPropagation(); openWaiveModal(c.id, c.case_name, c.outstanding) }}
                                className="text-xs text-[var(--color-danger)] hover:opacity-80"
                              >
                                포기
                              </button>
                            </div>
                          ))}

                          {/* Memos */}
                          {memos.length > 0 && (
                            <div className="px-4 py-3 pl-14 space-y-2">
                              {memos.map((m) => (
                                <div key={m.id} className="flex items-start gap-2 group">
                                  <input
                                    type="checkbox"
                                    checked={m.is_completed}
                                    onChange={() => toggleMemo(m.id, m.is_completed)}
                                    className="mt-0.5 w-3.5 h-3.5 rounded border-[var(--border-default)]"
                                  />
                                  <span className={`text-[14px] flex-1 ${m.is_completed ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-secondary)]'}`}>
                                    {m.content}
                                    <span className="text-[var(--text-muted)] ml-2 text-xs">{fmtDate(m.created_at)}</span>
                                  </span>
                                  <button onClick={() => deleteMemo(m.id)} className="text-xs text-[var(--text-muted)] hover:text-[var(--color-danger)] opacity-0 group-hover:opacity-100">×</button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add Memo */}
                          <div className="px-4 py-2 pl-14 flex gap-2">
                            <input
                              type="text"
                              value={newMemoContent[client.client_id] || ''}
                              onChange={(e) => setNewMemoContent(prev => ({ ...prev, [client.client_id]: e.target.value }))}
                              onKeyDown={(e) => e.key === 'Enter' && addMemo(client.client_id)}
                              placeholder="메모 추가"
                              className="form-input flex-1 px-2 py-1 text-xs"
                            />
                            <button
                              onClick={() => addMemo(client.client_id)}
                              disabled={!newMemoContent[client.client_id]?.trim()}
                              className="btn btn-primary px-2 py-1 text-xs disabled:opacity-40"
                            >
                              추가
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Writeoffs */}
        {activeTab === 'writeoffs' && (
          <div className="card">
            {!data?.writeoffs?.length ? (
              <div className="py-12 text-center text-[var(--text-muted)]">포기 이력 없음</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-primary)] text-[var(--text-tertiary)] text-xs">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">사건</th>
                    <th className="px-4 py-2 text-left font-medium">의뢰인</th>
                    <th className="px-4 py-2 text-right font-medium">금액</th>
                    <th className="px-4 py-2 text-left font-medium">사유</th>
                    <th className="px-4 py-2 text-right font-medium">일자</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {data.writeoffs.map((w) => (
                    <tr key={w.id}>
                      <td className="px-4 py-2 text-[var(--text-primary)]">{w.case_name}</td>
                      <td className="px-4 py-2 text-[var(--text-tertiary)]">{w.client_name || '-'}</td>
                      <td className="px-4 py-2 text-right text-[var(--text-muted)] line-through">{formatCurrency(w.original_amount)}</td>
                      <td className="px-4 py-2 text-[var(--text-tertiary)] truncate max-w-[200px]">{w.reason || '-'}</td>
                      <td className="px-4 py-2 text-right text-[var(--text-muted)]">{fmtDate(w.written_off_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Modal */}
      {waiveModal.isOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-sm p-5">
            <h3 className="font-bold text-[var(--text-primary)] mb-3">미수금 포기</h3>
            <div className="bg-[var(--bg-primary)] rounded p-3 mb-3">
              <p className="text-sm text-[var(--text-secondary)]">{waiveModal.caseName}</p>
              <p className="text-lg font-medium text-[var(--text-primary)]">{formatCurrency(waiveModal.amount)}</p>
            </div>
            <textarea
              value={waiveReason}
              onChange={(e) => setWaiveReason(e.target.value)}
              placeholder="포기 사유"
              rows={2}
              className="form-input w-full px-3 py-2 text-sm mb-3"
            />
            <div className="flex gap-2">
              <button onClick={closeWaiveModal} className="btn btn-secondary flex-1 py-2 text-sm">취소</button>
              <button
                onClick={handleWaive}
                disabled={waiving || !waiveReason.trim()}
                className="flex-1 py-2 text-sm bg-[var(--color-danger)] text-white rounded disabled:opacity-50"
              >
                {waiving ? '처리중' : '포기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
