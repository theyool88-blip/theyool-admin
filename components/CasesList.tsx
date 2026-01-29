'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  Plus,
  LayoutGrid,
  LayoutList,
  Calendar,
  CreditCard,
  ChevronDown,
  Cloud,
  Layers,
  CornerDownRight,
  Columns,
  Download,
} from 'lucide-react'
import { exportCasesToExcel } from '@/lib/excel-export'
import UnifiedScheduleModal from './UnifiedScheduleModal'
import CasePaymentsModal from './CasePaymentsModal'
import DataTable, { Pagination, TableToolbar, Column } from './ui/DataTable'
import { CaseStatusBadge } from './ui/StatusBadge'
import { EmptySearchResults, EmptyCases } from './ui/EmptyState'
import { getCourtAbbrev } from '@/lib/scourt/court-codes'

interface Client {
  id: string
  name: string
}

interface CaseAssignee {
  id: string
  memberId: string
  isPrimary: boolean
  displayName: string
  role: string
}

export interface LegalCase {
  id: string
  contract_number: string
  case_name: string
  case_type: string | null
  client_id: string
  status: '진행중' | '종결'
  assigned_to?: string
  assigned_member?: {
    id: string
    display_name: string
    role: string
  }
  assignees?: CaseAssignee[]
  contract_date: string
  court_case_number: string | null
  court_name: string | null
  case_level: string | null
  main_case_id: string | null
  onedrive_folder_url: string | null
  client?: Client
  payment_info?: {
    total_amount: number
    payment_count: number
  }
  parties?: {
    ourClient: string | null
    ourClientLabel: string | null
    opponent: string | null
    opponentLabel: string | null
  }
  next_hearing?: {
    date: string
    type: string
  } | null
  _isSubCase?: boolean
}

type ViewMode = 'table' | 'card'
type SortDirection = 'asc' | 'desc' | null

const COLUMN_DEFINITIONS = [
  { id: 'status', label: '상태' },
  { id: 'contract_number', label: '계약번호' },
  { id: 'contract_date', label: '계약일' },
  { id: 'court_name', label: '법원' },
  { id: 'court_case_number', label: '사건번호' },
  { id: 'case_level', label: '심급' },
  { id: 'case_name', label: '사건명' },
  { id: 'parties', label: '당사자' },
  { id: 'next_hearing', label: '다음기일' },
  { id: 'assignee', label: '담당변호사' },
  { id: 'outstanding_amount', label: '미수금' },
]

const DEFAULT_VISIBLE_COLUMNS = [
  'status', 'contract_number', 'contract_date', 'court_name', 'court_case_number',
  'case_level', 'case_name', 'parties', 'next_hearing', 'assignee', 'outstanding_amount'
]

export default function CasesList({ initialCases }: { initialCases: LegalCase[] }) {
  const cases = initialCases
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | '진행중' | '종결'>('진행중')
  const [currentPage, setCurrentPage] = useState(1)
  const [casesPerPage, setCasesPerPage] = useState(50)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [selectedCaseId, setSelectedCaseId] = useState<string | undefined>(undefined)
  const [selectedCaseNumber, setSelectedCaseNumber] = useState<string | undefined>(undefined)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedCaseForPayment, setSelectedCaseForPayment] = useState<LegalCase | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [sortColumn, setSortColumn] = useState<string>('contract_date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [groupByMainCase, setGroupByMainCase] = useState(false)
  const [lawyerFilter, setLawyerFilter] = useState<string>('all')
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cases-visible-columns')
      return saved ? JSON.parse(saved) : DEFAULT_VISIBLE_COLUMNS
    }
    return DEFAULT_VISIBLE_COLUMNS
  })
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const router = useRouter()

  useEffect(() => {
    localStorage.setItem('cases-visible-columns', JSON.stringify(visibleColumns))
  }, [visibleColumns])

  const allLawyers = useMemo(() => {
    const LAWYER_ROLES = ['lawyer', 'owner', 'admin']
    const lawyerMap = new Map<string, string>()
    cases.forEach(c => {
      c.assignees?.filter(a => LAWYER_ROLES.includes(a.role)).forEach(a => {
        lawyerMap.set(a.memberId, a.displayName)
      })
    })
    return Array.from(lawyerMap.entries()).map(([id, name]) => ({ id, name }))
  }, [cases])

  const processedCases = useMemo(() => {
    let filtered = [...cases]

    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter)
    }

    if (lawyerFilter !== 'all') {
      filtered = filtered.filter(c =>
        c.assignees?.some(a => a.memberId === lawyerFilter)
      )
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(c =>
        c.contract_number?.toLowerCase().includes(term) ||
        c.case_name?.toLowerCase().includes(term) ||
        c.client?.name?.toLowerCase().includes(term) ||
        c.court_case_number?.toLowerCase().includes(term) ||
        c.court_name?.toLowerCase().includes(term) ||
        c.parties?.ourClient?.toLowerCase().includes(term) ||
        c.parties?.opponent?.toLowerCase().includes(term)
      )
    }

    // 그룹화 모드가 아니면 기존 정렬만
    if (!groupByMainCase) {
      if (sortColumn && sortDirection) {
        filtered.sort((a, b) => {
          let aVal: string | number = ''
          let bVal: string | number = ''

          switch (sortColumn) {
            case 'contract_date':
              aVal = a.contract_date || ''
              bVal = b.contract_date || ''
              break
            case 'case_name':
              aVal = a.case_name || ''
              bVal = b.case_name || ''
              break
            case 'client':
              aVal = a.client?.name || ''
              bVal = b.client?.name || ''
              break
            case 'status':
              aVal = a.status
              bVal = b.status
              break
          }

          if (sortDirection === 'asc') {
            return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
          } else {
            return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
          }
        })
      }
      return filtered
    }

    // 그룹화 모드: 주사건-서브사건 그룹핑
    const mainCases = filtered.filter(c => !c.main_case_id)
    const subCases = filtered.filter(c => c.main_case_id)

    // 서브사건을 main_case_id로 그룹화
    const subCaseMap = new Map<string, typeof filtered>()
    for (const sub of subCases) {
      const mainId = sub.main_case_id!
      if (!subCaseMap.has(mainId)) {
        subCaseMap.set(mainId, [])
      }
      subCaseMap.get(mainId)!.push(sub)
    }

    // 주사건 정렬 (최신순)
    const sortedMains = [...mainCases].sort((a, b) => {
      const aDate = a.contract_date || ''
      const bDate = b.contract_date || ''
      return bDate.localeCompare(aDate)
    })

    // 주사건 아래에 서브사건 삽입
    const result: (LegalCase & { _isSubCase?: boolean })[] = []
    for (const main of sortedMains) {
      result.push(main)
      const subs = subCaseMap.get(main.id) || []
      // 서브사건 심급 순서로 정렬
      const levelOrder: Record<string, number> = {
        '1심': 1,
        '2심(항소심)': 2,
        '3심(상고심)': 3,
      }
      const sortedSubs = subs.sort((a, b) =>
        (levelOrder[a.case_level || ''] || 0) - (levelOrder[b.case_level || ''] || 0)
      )
      for (const sub of sortedSubs) {
        result.push({ ...sub, _isSubCase: true })
      }
    }

    // 주사건 없이 떠도는 서브사건 추가
    const includedMainIds = new Set(sortedMains.map(m => m.id))
    const orphanSubs = subCases.filter(s => !includedMainIds.has(s.main_case_id!))
    result.push(...orphanSubs)

    return result
  }, [cases, searchTerm, statusFilter, lawyerFilter, groupByMainCase, sortColumn, sortDirection])

  const indexOfLastCase = currentPage * casesPerPage
  const indexOfFirstCase = indexOfLastCase - casesPerPage
  const currentCases = processedCases.slice(indexOfFirstCase, indexOfLastCase)
  const totalPages = Math.ceil(processedCases.length / casesPerPage)

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    const year = String(date.getFullYear()).slice(2)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}.${month}.${day}`
  }

  const handleSort = (column: string, direction: SortDirection) => {
    setSortColumn(column)
    setSortDirection(direction)
  }

  const handleAddSchedule = (e: React.MouseEvent, caseId: string, caseNumber: string | null) => {
    e.stopPropagation()
    setSelectedCaseId(caseId)
    setSelectedCaseNumber(caseNumber || undefined)
    setShowScheduleModal(true)
  }

  const handleOpenPaymentModal = (e: React.MouseEvent, legalCase: LegalCase) => {
    e.stopPropagation()
    setSelectedCaseForPayment(legalCase)
    setShowPaymentModal(true)
  }

  const handlePaymentAdded = () => {
    setShowPaymentModal(false)
    setSelectedCaseForPayment(null)
  }

  // Table columns definition (순서: 상태→계약번호→계약일→법원→사건번호→심급→사건명→당사자→다음기일→담당변호사→미수금)
  const columns: Column<LegalCase>[] = [
    {
      key: 'status',
      header: '상태',
      width: '80px',
      align: 'center',
      sortable: true,
      render: (item) => <CaseStatusBadge status={item.status} />,
    },
    {
      key: 'contract_number',
      header: '계약번호',
      width: '100px',
      render: (item) => (
        <span className="text-body font-mono text-sm">
          {item.contract_number || '-'}
        </span>
      ),
    },
    {
      key: 'contract_date',
      header: '계약일',
      width: '100px',
      sortable: true,
      render: (item) => (
        <span className="text-caption">{formatDate(item.contract_date)}</span>
      ),
    },
    {
      key: 'court_name',
      header: '법원',
      width: '90px',
      render: (item) => (
        <span className="text-caption truncate" title={item.court_name || ''}>
          {getCourtAbbrev(item.court_name) || '-'}
        </span>
      ),
    },
    {
      key: 'court_case_number',
      header: '사건번호',
      width: '140px',
      render: (item) => (
        <span className="text-body font-mono text-sm">
          {item.court_case_number || '-'}
        </span>
      ),
    },
    {
      key: 'case_level',
      header: '심급',
      width: '70px',
      render: (item) => item.case_level
        ? <CaseLevelBadge level={item.case_level} />
        : <span className="text-[var(--text-muted)]">-</span>,
    },
    {
      key: 'case_name',
      header: '사건명',
      sortable: !groupByMainCase,
      render: (item) => (
        <div className={`flex items-center gap-1.5 ${
          item._isSubCase ? 'pl-5' : ''
        }`}>
          {item._isSubCase && (
            <CornerDownRight className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
          )}
          <span className="text-body truncate max-w-[200px]">{item.case_name}</span>
          {item.onedrive_folder_url && (
            <span title="OneDrive 연결됨">
              <Cloud className="w-4 h-4 text-[var(--color-info)] flex-shrink-0" />
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'parties',
      header: '당사자',
      width: '180px',
      render: (item) => <PartiesCell parties={item.parties} clientName={item.client?.name} />,
    },
    {
      key: 'next_hearing',
      header: '다음기일',
      width: '130px',
      render: (item) => {
        if (!item.next_hearing) return <span className="text-[var(--text-muted)]">-</span>
        const date = new Date(item.next_hearing.date)
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return (
          <div className="text-body text-sm">
            <span>{month}/{day}</span>
            <span className="text-[var(--text-muted)] ml-1">({item.next_hearing.type})</span>
          </div>
        )
      },
    },
    {
      key: 'assignee',
      header: '담당변호사',
      width: '140px',
      align: 'center',
      render: (item) => <AssigneeCell assignees={item.assignees} assignedMember={item.assigned_member} />,
    },
    {
      key: 'outstanding_amount',
      header: '미수금',
      width: '100px',
      align: 'right',
      render: () => {
        // TODO: 미수금 데이터는 서버에서 계산하여 전달 필요
        return <span className="text-[var(--text-muted)]">-</span>
      },
    },
  ]

  const displayedColumns = columns.filter(c => visibleColumns.includes(c.key))

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">사건 목록</h1>
          <p className="page-subtitle">총 {processedCases.length}건</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const filename = `cases-${new Date().toISOString().slice(0, 10)}.xlsx`
              exportCasesToExcel(processedCases, filename)
            }}
            className="btn btn-secondary"
            title="엑셀로 내보내기"
          >
            <Download className="w-4 h-4" />
            내보내기
          </button>
          <button
            onClick={() => router.push('/cases/new')}
            className="btn btn-primary"
          >
            <Plus className="w-4 h-4" />
            사건 추가
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <TableToolbar className="mb-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="계약번호, 사건명, 의뢰인, 사건번호, 법원, 당사자 검색..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
            className="form-input pl-9 w-full"
          />
        </div>

        {/* Status Filter */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as 'all' | '진행중' | '종결')
              setCurrentPage(1)
            }}
            className="form-input pr-8 appearance-none"
          >
            <option value="all">전체 상태</option>
            <option value="진행중">진행중</option>
            <option value="종결">종결</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
        </div>

        {/* Lawyer Filter */}
        <div className="relative">
          <select
            value={lawyerFilter}
            onChange={(e) => {
              setLawyerFilter(e.target.value)
              setCurrentPage(1)
            }}
            className="form-input pr-8 appearance-none"
          >
            <option value="all">전체 변호사</option>
            {allLawyers.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
        </div>

        {/* Group Toggle */}
        <button
          onClick={() => setGroupByMainCase(!groupByMainCase)}
          className={`p-1.5 rounded transition-colors ${
            groupByMainCase
              ? 'bg-[var(--sage-muted)] text-[var(--sage-primary)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          }`}
          title="주사건 그룹화"
        >
          <Layers className="w-4 h-4" />
        </button>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 p-1 bg-[var(--bg-tertiary)] rounded-lg">
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded transition-colors ${
              viewMode === 'table'
                ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
            title="테이블 뷰"
          >
            <LayoutList className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('card')}
            className={`p-1.5 rounded transition-colors ${
              viewMode === 'card'
                ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
            title="카드 뷰"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>

        {/* Column Selector */}
        <div className="relative">
          <button
            onClick={() => setShowColumnSelector(!showColumnSelector)}
            className="p-1.5 rounded transition-colors text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
            title="컬럼 설정"
          >
            <Columns className="w-4 h-4" />
          </button>
          {showColumnSelector && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowColumnSelector(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-50 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg shadow-lg py-2 min-w-[160px]">
                {COLUMN_DEFINITIONS.map(col => (
                  <label
                    key={col.id}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--bg-tertiary)] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns.includes(col.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setVisibleColumns([...visibleColumns, col.id])
                        } else {
                          if (visibleColumns.length > 1) {
                            setVisibleColumns(visibleColumns.filter(v => v !== col.id))
                          }
                        }
                      }}
                      className="form-checkbox"
                    />
                    <span className="text-caption">{col.label}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </TableToolbar>

      {/* Content */}
      {currentCases.length === 0 ? (
        searchTerm ? (
          <EmptySearchResults
            searchTerm={searchTerm}
            onClear={() => setSearchTerm('')}
          />
        ) : (
          <EmptyCases onAddCase={() => router.push('/cases/new')} />
        )
      ) : viewMode === 'table' ? (
        /* Table View */
        <DataTable
          data={currentCases}
          columns={displayedColumns}
          keyExtractor={(item) => item.id}
          onRowClick={(item) => router.push(`/cases/${item.id}`)}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
          rowActions={(item) => (
            <>
              <button
                onClick={(e) => handleOpenPaymentModal(e, item)}
                className="p-1.5 rounded text-[var(--color-success)] hover:bg-[var(--color-success)]/10 transition-colors"
                title="입금 등록"
              >
                <CreditCard className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => handleAddSchedule(e, item.id, item.court_case_number)}
                className="p-1.5 rounded text-[var(--sage-primary)] hover:bg-[var(--sage-muted)] transition-colors"
                title="기일 등록"
              >
                <Calendar className="w-4 h-4" />
              </button>
            </>
          )}
        />
      ) : (
        /* Card View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentCases.map((legalCase) => (
            <CaseCard
              key={legalCase.id}
              legalCase={legalCase}
              formatDate={formatDate}
              onClick={() => router.push(`/cases/${legalCase.id}`)}
              onPayment={(e) => handleOpenPaymentModal(e, legalCase)}
              onSchedule={(e) => handleAddSchedule(e, legalCase.id, legalCase.court_case_number)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={processedCases.length}
          itemsPerPage={casesPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(n) => {
            setCasesPerPage(n)
            setCurrentPage(1)
          }}
          itemsPerPageOptions={[25, 50, 100]}
          className="mt-4"
        />
      )}

      {/* Unified Schedule Modal */}
      <UnifiedScheduleModal
        isOpen={showScheduleModal}
        onClose={() => {
          setShowScheduleModal(false)
          setSelectedCaseId(undefined)
          setSelectedCaseNumber(undefined)
        }}
        onSuccess={() => {
          setShowScheduleModal(false)
          setSelectedCaseId(undefined)
          setSelectedCaseNumber(undefined)
        }}
        prefilledCaseId={selectedCaseId}
        prefilledCaseNumber={selectedCaseNumber}
      />

      {/* Payment Modal */}
      {selectedCaseForPayment && (
        <CasePaymentsModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false)
            setSelectedCaseForPayment(null)
          }}
          caseId={selectedCaseForPayment.id}
          caseName={selectedCaseForPayment.case_name}
          clientName={selectedCaseForPayment.client?.name}
          onPaymentAdded={handlePaymentAdded}
        />
      )}
    </div>
  )
}

// Sub-components
interface AssigneeCellProps {
  assignees?: CaseAssignee[]
  assignedMember?: {
    id: string
    display_name: string
    role: string
  }
}

function AssigneeCell({ assignees, assignedMember }: AssigneeCellProps) {
  const LAWYER_ROLES = ['lawyer', 'owner', 'admin']
  const lawyers = assignees?.filter(a => LAWYER_ROLES.includes(a.role)) || []
  const primary = lawyers.find(a => a.isPrimary)
  const others = lawyers.filter(a => !a.isPrimary)

  if (lawyers.length > 0) {
    // 모든 변호사 이름을 콤마로 연결 (주담당 우선)
    const allNames = primary
      ? [primary.displayName, ...others.map(a => a.displayName)]
      : others.map(a => a.displayName)

    return (
      <span className="text-body text-sm">
        {allNames.join(', ')}
      </span>
    )
  }

  // Legacy fallback
  if (assignedMember?.display_name) {
    return (
      <span className="text-body text-sm">
        {assignedMember.display_name}
      </span>
    )
  }

  return <span className="text-[var(--text-muted)]">-</span>
}

interface CaseCardProps {
  legalCase: LegalCase
  formatDate: (date: string | null) => string
  onClick: () => void
  onPayment: (e: React.MouseEvent) => void
  onSchedule: (e: React.MouseEvent) => void
}

function CaseCard({ legalCase, formatDate, onClick, onPayment, onSchedule }: CaseCardProps) {
  const primary = legalCase.assignees?.find(a => a.isPrimary)

  return (
    <div
      onClick={onClick}
      className="card p-4 cursor-pointer hover:border-[var(--sage-primary)] transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {/* 심급 뱃지 */}
            {legalCase.case_level && legalCase.case_level !== '1심' && (
              <CaseLevelBadge level={legalCase.case_level} />
            )}
            <h3 className="text-body font-semibold truncate">{legalCase.case_name}</h3>
          </div>
          {/* 당사자 표시 */}
          <p className="text-caption mt-0.5">
            {legalCase.parties?.ourClient || legalCase.client?.name || '-'}
            {legalCase.parties?.opponent && (
              <span className="text-[var(--text-muted)]"> v {legalCase.parties.opponent}</span>
            )}
          </p>
        </div>
        <CaseStatusBadge status={legalCase.status} />
      </div>

      {/* Meta */}
      <div className="space-y-2 mb-4">
        {/* 사건번호 */}
        {legalCase.court_case_number && (
          <div className="flex items-center justify-between text-caption">
            <span className="text-[var(--text-muted)]">사건번호</span>
            <span className="font-mono text-sm">{legalCase.court_case_number}</span>
          </div>
        )}
        {/* 법원 */}
        {legalCase.court_name && (
          <div className="flex items-center justify-between text-caption">
            <span className="text-[var(--text-muted)]">법원</span>
            <span>{getCourtAbbrev(legalCase.court_name)}</span>
          </div>
        )}
        {/* 계약일 */}
        <div className="flex items-center justify-between text-caption">
          <span className="text-[var(--text-muted)]">계약일</span>
          <span>{formatDate(legalCase.contract_date)}</span>
        </div>
        {/* 담당변호사 */}
        <div className="flex items-center justify-between text-caption">
          <span className="text-[var(--text-muted)]">담당변호사</span>
          <span>{primary?.displayName || legalCase.assigned_member?.display_name || '-'}</span>
        </div>
      </div>

      {/* Cloud indicator */}
      {legalCase.onedrive_folder_url && (
        <div className="flex items-center gap-1.5 text-caption text-[var(--color-info)] mb-3">
          <Cloud className="w-3.5 h-3.5" />
          <span>OneDrive 연결됨</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-[var(--border-default)]">
        <button
          onClick={onPayment}
          className="flex-1 btn btn-ghost btn-sm justify-center text-[var(--color-success)]"
        >
          <CreditCard className="w-4 h-4" />
          입금
        </button>
        <button
          onClick={onSchedule}
          className="flex-1 btn btn-ghost btn-sm justify-center text-[var(--sage-primary)]"
        >
          <Calendar className="w-4 h-4" />
          기일
        </button>
      </div>
    </div>
  )
}

// Helper functions for new columns
function CaseLevelBadge({ level }: { level: string }) {
  const colorMap: Record<string, string> = {
    '1심': 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]',
    '2심(항소심)': 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
    '3심(상고심)': 'bg-[var(--color-error)]/10 text-[var(--color-error)]',
  }
  const shortLabel = level
    .replace('2심(항소심)', '항소심')
    .replace('3심(상고심)', '상고심')
  return (
    <span className={`px-1.5 py-0.5 text-xs rounded ${colorMap[level] || ''}`}>
      {shortLabel}
    </span>
  )
}

function PartiesCell({ parties, clientName }: {
  parties?: LegalCase['parties']
  clientName?: string
}) {
  const ourClient = parties?.ourClient || clientName
  if (!ourClient) return <span className="text-[var(--text-muted)]">-</span>

  return (
    <div className="text-body text-sm truncate">
      <span className="font-medium">{ourClient}</span>
      {parties?.opponent && (
        <>
          <span className="text-[var(--text-muted)] mx-1">v</span>
          <span>{parties.opponent}</span>
        </>
      )}
    </div>
  )
}
