'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, UserCircle, Scale, X, Plus } from 'lucide-react'

interface Member {
  id: string
  display_name: string | null
  role: string
}

interface Assignment {
  id: string
  staffMemberId: string
  lawyerMemberId: string
  lawyerMember: {
    id: string
    displayName: string
    role: string
  } | null
}

interface StaffWithAssignments {
  staff: Member
  assignments: Assignment[]
}

export default function StaffLawyerAssignments() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [staffMembers, setStaffMembers] = useState<Member[]>([])
  const [lawyerMembers, setLawyerMembers] = useState<Member[]>([])
  const [assignments, setAssignments] = useState<Record<string, Assignment[]>>({})
  const [showAddLawyer, setShowAddLawyer] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    setError('')

    try {
      // Fetch staff members
      const staffRes = await fetch('/api/admin/tenant/members?role=staff')
      const staffData = await staffRes.json()
      if (staffData.members) {
        setStaffMembers(staffData.members)
      }

      // Fetch lawyer members (including admin and owner who can be lawyers)
      const lawyerRes = await fetch('/api/admin/tenant/members?role=lawyer,admin,owner')
      const lawyerData = await lawyerRes.json()
      if (lawyerData.members) {
        setLawyerMembers(lawyerData.members)
      }

      // Fetch all assignments
      const assignRes = await fetch('/api/admin/staff-lawyer-assignments')
      const assignData = await assignRes.json()
      if (assignData.success && assignData.assignments) {
        // Group assignments by staff member
        const grouped: Record<string, Assignment[]> = {}
        assignData.assignments.forEach((a: Assignment) => {
          if (!grouped[a.staffMemberId]) {
            grouped[a.staffMemberId] = []
          }
          grouped[a.staffMemberId].push(a)
        })
        setAssignments(grouped)
      }
    } catch (err) {
      console.error('Failed to fetch data:', err)
      setError('데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleAddLawyer = async (staffId: string, lawyerId: string) => {
    setSaving(staffId)
    setError('')

    try {
      const response = await fetch('/api/admin/staff-lawyer-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_member_id: staffId,
          lawyer_member_id: lawyerId
        })
      })

      const result = await response.json()

      if (!result.success) {
        setError(result.error || '추가에 실패했습니다.')
        return
      }

      // Update local state
      const newAssignment = result.assignment
      setAssignments(prev => ({
        ...prev,
        [staffId]: [...(prev[staffId] || []), newAssignment]
      }))
      setShowAddLawyer(null)
    } catch (err) {
      console.error('Failed to add assignment:', err)
      setError('추가 중 오류가 발생했습니다.')
    } finally {
      setSaving(null)
    }
  }

  const handleRemoveLawyer = async (staffId: string, assignmentId: string) => {
    if (!confirm('이 담당 변호사 매핑을 삭제하시겠습니까?')) return

    setSaving(staffId)
    setError('')

    try {
      const response = await fetch(`/api/admin/staff-lawyer-assignments?id=${assignmentId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (!result.success) {
        setError(result.error || '삭제에 실패했습니다.')
        return
      }

      // Update local state
      setAssignments(prev => ({
        ...prev,
        [staffId]: (prev[staffId] || []).filter(a => a.id !== assignmentId)
      }))
    } catch (err) {
      console.error('Failed to remove assignment:', err)
      setError('삭제 중 오류가 발생했습니다.')
    } finally {
      setSaving(null)
    }
  }

  const getAssignedLawyerIds = (staffId: string): string[] => {
    return (assignments[staffId] || []).map(a => a.lawyerMemberId)
  }

  const getAvailableLawyers = (staffId: string): Member[] => {
    const assignedIds = getAssignedLawyerIds(staffId)
    return lawyerMembers.filter(l => !assignedIds.includes(l.id))
  }

  if (loading) {
    return (
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">직원-변호사 매핑</h2>
        <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-caption">로딩 중...</span>
        </div>
      </div>
    )
  }

  if (staffMembers.length === 0) {
    return (
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">직원-변호사 매핑</h2>
        <p className="text-caption text-[var(--text-tertiary)]">직원(Staff) 역할의 팀원이 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">직원-변호사 매핑</h2>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
            직원이 담당할 변호사를 지정합니다. 직원은 담당 변호사의 사건/상담만 관리할 수 있습니다.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-[var(--color-danger-muted)] border border-[var(--color-danger)] rounded-lg">
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        {staffMembers.map(staff => {
          const staffAssignments = assignments[staff.id] || []
          const availableLawyers = getAvailableLawyers(staff.id)
          const isShowingAdd = showAddLawyer === staff.id
          const isSaving = saving === staff.id

          return (
            <div key={staff.id} className="border border-[var(--border-default)] rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
                  <UserCircle className="w-4 h-4 text-[var(--text-tertiary)]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {staff.display_name || '이름 없음'}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)]">직원</p>
                </div>
              </div>

              {/* Assigned Lawyers */}
              <div className="ml-11">
                <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">담당 변호사</p>

                {staffAssignments.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)] mb-2">지정된 변호사가 없습니다</p>
                ) : (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {staffAssignments.map(assignment => (
                      <span
                        key={assignment.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--sage-muted)] text-[var(--sage-primary)] rounded-full text-xs"
                      >
                        <Scale className="w-3 h-3" />
                        {assignment.lawyerMember?.displayName || '변호사'}
                        <button
                          onClick={() => handleRemoveLawyer(staff.id, assignment.id)}
                          disabled={isSaving}
                          className="ml-0.5 hover:text-[var(--color-danger)] transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Add Lawyer Button/Dropdown */}
                {isShowingAdd ? (
                  <div className="flex items-center gap-2">
                    <select
                      className="form-input h-8 px-2 text-xs"
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddLawyer(staff.id, e.target.value)
                        }
                      }}
                      disabled={isSaving}
                      defaultValue=""
                    >
                      <option value="">변호사 선택...</option>
                      {availableLawyers.map(lawyer => (
                        <option key={lawyer.id} value={lawyer.id}>
                          {lawyer.display_name || '이름 없음'}
                          {lawyer.role === 'owner' && ' (대표)'}
                          {lawyer.role === 'admin' && ' (관리자)'}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setShowAddLawyer(null)}
                      className="btn-ghost text-xs px-2 py-1"
                    >
                      취소
                    </button>
                    {isSaving && <RefreshCw className="w-3 h-3 animate-spin text-[var(--text-muted)]" />}
                  </div>
                ) : (
                  availableLawyers.length > 0 && (
                    <button
                      onClick={() => setShowAddLawyer(staff.id)}
                      className="inline-flex items-center gap-1 text-xs text-[var(--sage-primary)] hover:opacity-80"
                    >
                      <Plus className="w-3 h-3" />
                      변호사 추가
                    </button>
                  )
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
