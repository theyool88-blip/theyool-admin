'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Search,
  Plus,
  LayoutGrid,
  LayoutList,
  Phone,
  Mail,
  FileText,
  AlertCircle,
  ChevronDown,
} from 'lucide-react'
import DataTable, { Pagination, TableToolbar, Column } from './ui/DataTable'
import StatusBadge from './ui/StatusBadge'
import { EmptySearchResults, EmptyClients } from './ui/EmptyState'

interface Client {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  birth_date: string | null
  notes: string | null
  created_at: string
  total_outstanding: number
  client_type: 'individual' | 'corporation' | null
  company_name: string | null
  latest_case: {
    id: string
    case_name: string
  } | null
}

interface Profile {
  id: string
  name: string
  email: string
  role: string
}

type ViewMode = 'table' | 'card'
type SortDirection = 'asc' | 'desc' | null

export default function ClientsList({ profile: _profile, initialClients }: { profile: Profile, initialClients: Client[] }) {
  const [clients] = useState<Client[]>(initialClients)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [clientsPerPage, setClientsPerPage] = useState(50)
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [sortColumn, setSortColumn] = useState<string>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [outstandingFilter, setOutstandingFilter] = useState<'all' | 'hasOutstanding'>('all')
  const router = useRouter()

  const filteredClients = useMemo(() => {
    let filtered = [...clients]

    // Outstanding filter
    if (outstandingFilter === 'hasOutstanding') {
      filtered = filtered.filter(c => c.total_outstanding > 0)
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(c =>
        c.name?.toLowerCase().includes(term) ||
        c.phone?.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term)
      )
    }

    // Sort
    if (sortColumn && sortDirection) {
      filtered.sort((a, b) => {
        let aVal: string | number = ''
        let bVal: string | number = ''

        switch (sortColumn) {
          case 'name':
            aVal = a.name || ''
            bVal = b.name || ''
            break
          case 'total_outstanding':
            aVal = a.total_outstanding || 0
            bVal = b.total_outstanding || 0
            break
          case 'created_at':
            aVal = a.created_at || ''
            bVal = b.created_at || ''
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
  }, [clients, searchTerm, sortColumn, sortDirection, outstandingFilter])

  // Pagination
  const indexOfLastClient = currentPage * clientsPerPage
  const indexOfFirstClient = indexOfLastClient - clientsPerPage
  const currentClients = filteredClients.slice(indexOfFirstClient, indexOfLastClient)
  const totalPages = Math.ceil(filteredClients.length / clientsPerPage)

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString('ko-KR')}원`
  }

  const handleSort = (column: string, direction: SortDirection) => {
    setSortColumn(column)
    setSortDirection(direction)
  }

  const handleCaseClick = (e: React.MouseEvent, caseId: string) => {
    e.stopPropagation()
    router.push(`/cases/${caseId}`)
  }

  // Table columns
  const columns: Column<Client>[] = [
    {
      key: 'name',
      header: '이름',
      sortable: true,
      render: (item) => (
        <div>
          <span className="text-body font-medium">{item.name}</span>
          {item.client_type === 'corporation' && item.company_name && (
            <span className="text-caption text-[var(--text-muted)] ml-1">({item.company_name})</span>
          )}
        </div>
      ),
    },
    {
      key: 'phone',
      header: '연락처',
      width: '140px',
      render: (item) => (
        <span className="text-body">{item.phone || '-'}</span>
      ),
    },
    {
      key: 'email',
      header: '이메일',
      width: '200px',
      render: (item) => (
        <span className="text-caption">{item.email || '-'}</span>
      ),
    },
    {
      key: 'latest_case',
      header: '등록사건',
      render: (item) => item.latest_case ? (
        <button
          onClick={(e) => handleCaseClick(e, item.latest_case!.id)}
          className="text-body text-[var(--sage-primary)] hover:text-[var(--sage-primary-hover)] hover:underline text-left truncate max-w-[200px] block"
        >
          {item.latest_case.case_name}
        </button>
      ) : (
        <span className="text-[var(--text-muted)]">-</span>
      ),
    },
    {
      key: 'total_outstanding',
      header: '미수금',
      width: '120px',
      align: 'right',
      sortable: true,
      render: (item) => item.total_outstanding > 0 ? (
        <StatusBadge variant="danger" showDot={false}>
          {formatCurrency(item.total_outstanding)}
        </StatusBadge>
      ) : (
        <span className="text-caption text-[var(--text-muted)]">0원</span>
      ),
    },
  ]

  // Count clients with outstanding
  const clientsWithOutstanding = clients.filter(c => c.total_outstanding > 0).length

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">의뢰인 목록</h1>
          <p className="page-subtitle">
            총 {filteredClients.length}명
            {clientsWithOutstanding > 0 && (
              <span className="ml-2 text-[var(--color-danger)]">
                (미수금 {clientsWithOutstanding}명)
              </span>
            )}
          </p>
        </div>
        <Link href="/clients/new" className="btn btn-primary">
          <Plus className="w-4 h-4" />
          의뢰인 추가
        </Link>
      </div>

      {/* Toolbar */}
      <TableToolbar className="mb-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="이름, 연락처, 이메일로 검색..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
            className="form-input pl-9 w-full"
          />
        </div>

        {/* Outstanding Filter */}
        <div className="relative">
          <select
            value={outstandingFilter}
            onChange={(e) => {
              setOutstandingFilter(e.target.value as 'all' | 'hasOutstanding')
              setCurrentPage(1)
            }}
            className="form-input pr-8 appearance-none"
          >
            <option value="all">전체</option>
            <option value="hasOutstanding">미수금 있음</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
        </div>

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
      </TableToolbar>

      {/* Content */}
      {currentClients.length === 0 ? (
        searchTerm ? (
          <EmptySearchResults
            searchTerm={searchTerm}
            onClear={() => setSearchTerm('')}
          />
        ) : (
          <EmptyClients onAddClient={() => router.push('/clients/new')} />
        )
      ) : viewMode === 'table' ? (
        /* Table View */
        <DataTable
          data={currentClients}
          columns={columns}
          keyExtractor={(item) => item.id}
          onRowClick={(item) => router.push(`/clients/${item.id}`)}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
        />
      ) : (
        /* Card View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentClients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              formatCurrency={formatCurrency}
              onClick={() => router.push(`/clients/${client.id}`)}
              onCaseClick={handleCaseClick}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredClients.length}
          itemsPerPage={clientsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(n) => {
            setClientsPerPage(n)
            setCurrentPage(1)
          }}
          itemsPerPageOptions={[25, 50, 100]}
          className="mt-4"
        />
      )}
    </div>
  )
}

// Client Card Component
interface ClientCardProps {
  client: Client
  formatCurrency: (amount: number) => string
  onClick: () => void
  onCaseClick: (e: React.MouseEvent, caseId: string) => void
}

function ClientCard({ client, formatCurrency, onClick, onCaseClick }: ClientCardProps) {
  return (
    <div
      onClick={onClick}
      className="card p-4 cursor-pointer hover:border-[var(--sage-primary)] transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <div>
          <h3 className="text-body font-semibold">{client.name}</h3>
          {client.latest_case && (
            <button
              onClick={(e) => onCaseClick(e, client.latest_case!.id)}
              className="text-caption text-[var(--sage-primary)] hover:underline mt-0.5 text-left"
            >
              {client.latest_case.case_name}
            </button>
          )}
        </div>
        {client.total_outstanding > 0 && (
          <StatusBadge variant="danger" showDot={false}>
            {formatCurrency(client.total_outstanding)}
          </StatusBadge>
        )}
      </div>

      {/* Contact Info */}
      <div className="space-y-2">
        {client.phone && (
          <div className="flex items-center gap-2 text-caption">
            <Phone className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span>{client.phone}</span>
          </div>
        )}
        {client.email && (
          <div className="flex items-center gap-2 text-caption">
            <Mail className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span className="truncate">{client.email}</span>
          </div>
        )}
        {!client.phone && !client.email && (
          <p className="text-caption text-[var(--text-muted)]">연락처 미등록</p>
        )}
      </div>

      {/* Outstanding Warning */}
      {client.total_outstanding > 0 && (
        <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-[var(--border-default)] text-caption text-[var(--color-danger)]">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>미수금 있음</span>
        </div>
      )}
    </div>
  )
}
