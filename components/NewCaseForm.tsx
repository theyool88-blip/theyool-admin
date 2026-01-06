'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AdminHeader from './AdminHeader'
import { COURTS } from '@/lib/scourt/court-codes'

interface Client {
  id: string
  name: string
  phone: string | null
  email: string | null
}

interface NewCaseFormProps {
  clients: Client[]
  initialCaseNumber?: string  // URL에서 전달받은 사건번호
  initialCourtName?: string   // URL에서 전달받은 법원명
  initialClientId?: string    // URL에서 전달받은 의뢰인 ID
  initialPartyName?: string   // URL에서 전달받은 당사자명 (대법원 자동 연동용)
}

interface NewClientPayload {
  name: string
  phone: string
  email: string | null
  birth_date: string | null
  address: string | null
}

interface NewCasePayload {
  case_name: string
  case_type: string
  assigned_to?: string | null
  status: string
  contract_date: string
  retainer_fee: number | null
  success_fee_agreement: string | null
  notes: string
  client_id?: string
  new_client?: NewClientPayload
  court_case_number?: string | null
  court_name?: string | null
  judge_name?: string | null
  client_role?: 'plaintiff' | 'defendant' | null
}

export default function NewCaseForm({ clients, initialCaseNumber, initialCourtName, initialClientId, initialPartyName }: NewCaseFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isNewClient, setIsNewClient] = useState(false)

  const [formData, setFormData] = useState({
    case_name: '',
    client_id: initialClientId || '',
    case_type: '',
    assigned_to: '',
    status: '진행중',
    contract_date: new Date().toISOString().split('T')[0],
    retainer_fee: '',
    success_fee_agreement: '',
    notes: '',
    // 대법원 사건 정보
    court_case_number: initialCaseNumber || '',
    court_name: initialCourtName || '',
    judge_name: '',
    client_role: '' as 'plaintiff' | 'defendant' | '',
    // New client info
    client_name: '',
    client_phone: '',
    client_email: '',
    client_birth_date: '',
    client_address: ''
  })

  // URL 파라미터로 전달된 경우 자동 연동 플래그
  const [autoSyncTriggered, setAutoSyncTriggered] = useState(false)

  // 담당자 목록 (변호사)
  const [lawyerMembers, setLawyerMembers] = useState<{id: string, display_name: string | null, role: string}[]>([])

  // 대법원 검색 관련 상태
  const [scourtSearching, setScourtSearching] = useState(false)
  const [scourtSearchError, setScourtSearchError] = useState<string | null>(null)
  const [scourtSearchPartyName, setScourtSearchPartyName] = useState(initialPartyName || '')

  // 법원 선택 드롭다운
  const [showCourtDropdown, setShowCourtDropdown] = useState(false)
  const filteredCourts = COURTS.filter(c =>
    c.name.includes(formData.court_name)
  ).slice(0, 15)

  // 대법원 검색 성공 여부
  const [scourtSearchSuccess, setScourtSearchSuccess] = useState(false)

  // 담당자 목록 불러오기
  useEffect(() => {
    fetch('/api/admin/tenant/members?role=lawyer,admin,owner')
      .then(res => res.json())
      .then(data => {
        if (data.members) {
          setLawyerMembers(data.members)
        }
      })
      .catch(err => console.error('담당자 목록 조회 실패:', err))
  }, [])

  // URL 파라미터로 전달된 경우 자동 대법원 연동
  useEffect(() => {
    const autoSync = async () => {
      if (!initialCaseNumber || !initialCourtName || autoSyncTriggered) return

      setAutoSyncTriggered(true)

      // 당사자명이 있으면 자동 연동 시도
      if (initialPartyName) {
        // 사건번호 파싱
        const caseNumberOnly = initialCaseNumber.replace(/^[가-힣\s]+(?=\d)/, '').trim()
        const caseNumberPattern = /^(\d{4})([가-힣]+)(\d+)$/
        const match = caseNumberOnly.match(caseNumberPattern)

        if (!match) {
          setScourtSearchError('사건번호 형식이 올바르지 않습니다.')
          return
        }

        const [, caseYear, caseType, caseSerial] = match

        setScourtSearching(true)
        setScourtSearchError(null)

        try {
          const response = await fetch('/api/admin/scourt/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              caseYear,
              caseType,
              caseSerial,
              courtName: initialCourtName,
              partyName: initialPartyName
            })
          })

          const result = await response.json()

          if (result.success && result.caseInfo) {
            // 상세 정보 가져오기 (client_role 감지용)
            try {
              const detailRes = await fetch('/api/admin/scourt/detail', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  caseNumber: result.caseInfo.caseNumber,
                  encCsNo: result.caseInfo.encCsNo
                })
              })

              const detailResult = await detailRes.json()

              if (detailResult.success && detailResult.detail) {
                const detail = detailResult.detail

                // 의뢰인 이름으로 원고/피고 감지 (clientId로 의뢰인 조회)
                let detectedRole: 'plaintiff' | 'defendant' | '' = ''
                const selectedClient = initialClientId ? clients.find(c => c.id === initialClientId) : null
                const clientName = selectedClient?.name || ''

                if (clientName) {
                  // 의뢰인 이름으로 역할 감지
                  const isPlaintiff = detail.plaintiffs?.some((p: string) => p.includes(clientName))
                  const isDefendant = detail.defendants?.some((d: string) => d.includes(clientName))

                  if (isPlaintiff) detectedRole = 'plaintiff'
                  else if (isDefendant) detectedRole = 'defendant'
                } else {
                  // 의뢰인 정보 없으면 partyName으로 시도
                  const isPlaintiff = detail.plaintiffs?.some((p: string) => p.includes(initialPartyName))
                  const isDefendant = detail.defendants?.some((d: string) => d.includes(initialPartyName))

                  if (isPlaintiff) detectedRole = 'plaintiff'
                  else if (isDefendant) detectedRole = 'defendant'
                }

                setFormData(prev => ({
                  ...prev,
                  case_name: result.caseInfo.caseName || prev.case_name,
                  judge_name: detail.judge || result.caseInfo.judgeName || prev.judge_name,
                  court_name: detail.court || prev.court_name,
                  client_role: detectedRole || prev.client_role
                }))
              } else {
                // 상세 정보 실패 시 기본 정보만 설정
                setFormData(prev => ({
                  ...prev,
                  case_name: result.caseInfo.caseName || prev.case_name,
                  judge_name: result.caseInfo.judgeName || prev.judge_name,
                }))
              }
            } catch (detailErr) {
              console.error('상세 정보 조회 실패:', detailErr)
              // 상세 정보 실패해도 기본 정보는 설정
              setFormData(prev => ({
                ...prev,
                case_name: result.caseInfo.caseName || prev.case_name,
                judge_name: result.caseInfo.judgeName || prev.judge_name,
              }))
            }
            setScourtSearchSuccess(true)
            setScourtSearchError(null)
          } else {
            // 실패시 당사자 입력 안내
            setScourtSearchError(`자동 연동 실패: ${result.error || '사건을 찾을 수 없습니다'}. 당사자 이름을 수정하고 다시 시도해주세요.`)
          }
        } catch (err) {
          setScourtSearchError(`연동 오류: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
        } finally {
          setScourtSearching(false)
        }
      } else {
        // 당사자명 없으면 입력 안내
        setScourtSearchError('💡 대법원 연동을 위해 당사자 이름을 입력하고 [연동] 버튼을 눌러주세요.')
        setTimeout(() => {
          const partyInput = document.getElementById('scourt-party-name')
          if (partyInput) {
            partyInput.scrollIntoView({ behavior: 'smooth', block: 'center' })
            partyInput.focus()
          }
        }, 300)
      }
    }

    autoSync()
  }, [initialCaseNumber, initialCourtName, initialPartyName, autoSyncTriggered])

  // 대법원 사건 검색
  const handleScourtSearch = async () => {
    const caseNumber = formData.court_case_number.trim()
    const courtName = formData.court_name.trim()
    const partyName = scourtSearchPartyName.trim()

    if (!caseNumber || !courtName || !partyName) {
      setScourtSearchError('사건번호, 법원, 당사자이름을 모두 입력해주세요.')
      return
    }

    // 사건번호 파싱 (법원명 포함 가능: "수원가정법원 2024드단12345" 또는 "2024드단12345")
    const caseNumberOnly = caseNumber.replace(/^[가-힣\s]+(?=\d)/, '').trim()
    const caseNumberPattern = /^(\d{4})([가-힣]+)(\d+)$/
    const match = caseNumberOnly.match(caseNumberPattern)

    if (!match) {
      setScourtSearchError('사건번호 형식이 올바르지 않습니다. 예: 2024드단12345')
      return
    }

    const [, caseYear, caseType, caseSerial] = match

    setScourtSearching(true)
    setScourtSearchError(null)

    try {
      const response = await fetch('/api/admin/scourt/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseYear, caseType, caseSerial, courtName, partyName })
      })

      const result = await response.json()

      if (result.success && result.caseInfo) {
        const detailRes = await fetch('/api/admin/scourt/detail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caseNumber: result.caseInfo.caseNumber,
            encCsNo: result.caseInfo.encCsNo
          })
        })

        const detailResult = await detailRes.json()

        if (detailResult.success && detailResult.detail) {
          const detail = detailResult.detail

          let detectedRole: 'plaintiff' | 'defendant' | '' = ''
          const isPlaintiff = detail.plaintiffs?.some((p: string) => p.includes(partyName))
          const isDefendant = detail.defendants?.some((d: string) => d.includes(partyName))

          if (isPlaintiff) detectedRole = 'plaintiff'
          else if (isDefendant) detectedRole = 'defendant'

          setFormData(prev => ({
            ...prev,
            court_name: detail.court || prev.court_name,
            judge_name: detail.judge || prev.judge_name,
            client_role: detectedRole || prev.client_role
          }))
          setScourtSearchSuccess(true)
        } else {
          setFormData(prev => ({
            ...prev,
            court_name: result.caseInfo.court || prev.court_name
          }))
          setScourtSearchSuccess(true)
        }
      } else {
        setScourtSearchError(result.error || '사건을 찾을 수 없습니다.')
      }
    } catch (error) {
      console.error('대법원 검색 실패:', error)
      setScourtSearchError('대법원 검색 중 오류가 발생했습니다.')
    } finally {
      setScourtSearching(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const payload: NewCasePayload = {
        case_name: formData.case_name,
        case_type: formData.case_type,
        assigned_to: formData.assigned_to || null,
        status: formData.status,
        contract_date: formData.contract_date,
        retainer_fee: formData.retainer_fee ? Number(formData.retainer_fee) : null,
        success_fee_agreement: formData.success_fee_agreement || null,
        notes: formData.notes,
        court_case_number: formData.court_case_number || null,
        court_name: formData.court_name || null,
        judge_name: formData.judge_name || null,
        client_role: formData.client_role || null
      }

      if (isNewClient) {
        if (!formData.client_name || !formData.client_phone) {
          throw new Error('의뢰인 이름과 연락처는 필수입니다')
        }
        payload.new_client = {
          name: formData.client_name,
          phone: formData.client_phone,
          email: formData.client_email || null,
          birth_date: formData.client_birth_date || null,
          address: formData.client_address || null
        }
      } else {
        if (!formData.client_id) {
          throw new Error('의뢰인을 선택하세요')
        }
        payload.client_id = formData.client_id
      }

      const response = await fetch('/api/admin/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '사건 등록에 실패했습니다')
      }

      // SCOURT 검색 성공했으면 스냅샷 저장을 위해 sync 호출
      if (scourtSearchSuccess && formData.court_case_number) {
        try {
          console.log('🔄 사건 생성 후 SCOURT 동기화 시작...')
          await fetch('/api/admin/scourt/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              legalCaseId: data.data.id,
              caseNumber: formData.court_case_number,
              forceRefresh: true
            })
          })
          console.log('✅ SCOURT 동기화 완료')
        } catch (syncError) {
          console.error('SCOURT 동기화 실패 (사건은 정상 생성됨):', syncError)
        }
      }

      router.push(`/cases/${data.data.id}`)
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : '사건 등록에 실패했습니다'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader title="새 사건 등록" />

      <div className="max-w-3xl mx-auto pt-20 pb-8 px-4">
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Case Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">사건 정보</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  사건명 *
                </label>
                <input
                  type="text"
                  required
                  value={formData.case_name}
                  onChange={(e) => setFormData({ ...formData, case_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-sage-500"
                  placeholder="예: 김철수 이혼 사건"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  사건 유형 *
                </label>
                <select
                  required
                  value={formData.case_type}
                  onChange={(e) => setFormData({ ...formData, case_type: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sage-500"
                >
                  <option value="">선택하세요</option>
                  <option value="이혼">이혼</option>
                  <option value="재산분할">재산분할</option>
                  <option value="양육권">양육권</option>
                  <option value="위자료">위자료</option>
                  <option value="상간소송">상간소송</option>
                  <option value="기타">기타</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  담당 변호사
                </label>
                <select
                  value={formData.assigned_to}
                  onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sage-500"
                >
                  <option value="">선택하세요</option>
                  {lawyerMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.display_name || '이름 없음'}
                      {member.role === 'owner' && ' (대표)'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  상태
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sage-500"
                >
                  <option value="진행중">진행중</option>
                  <option value="완료">완료</option>
                  <option value="중단">중단</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  계약일
                </label>
                <input
                  type="date"
                  value={formData.contract_date}
                  onChange={(e) => setFormData({ ...formData, contract_date: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sage-500"
                  style={{ colorScheme: 'light' }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  착수금 (원)
                </label>
                <input
                  type="number"
                  value={formData.retainer_fee}
                  onChange={(e) => setFormData({ ...formData, retainer_fee: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-sage-500"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  성공보수 약정
                </label>
                <input
                  type="text"
                  value={formData.success_fee_agreement}
                  onChange={(e) => setFormData({ ...formData, success_fee_agreement: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-sage-500"
                  placeholder="예: 위자료 인정액의 5%"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  메모
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-sage-500"
                  placeholder="추가 메모 사항"
                />
              </div>
            </div>
          </div>

          {/* 대법원 검색 섹션 */}
          <div className={`rounded-lg border p-5 ${scourtSearchSuccess ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
            {scourtSearchSuccess ? (
              // 검색 성공 시 결과 표시
              <>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-green-800 flex items-center gap-2">
                    <span className="text-green-600">✓</span> 대법원 사건 연동 완료
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setScourtSearchSuccess(false)
                      setScourtSearchError(null)
                    }}
                    className="px-3 py-1 text-xs font-medium text-green-700 border border-green-300 rounded hover:bg-green-100"
                  >
                    다시 검색
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-green-700 text-xs">사건번호</span>
                    <p className="font-medium text-green-900">{formData.court_case_number}</p>
                  </div>
                  <div>
                    <span className="text-green-700 text-xs">법원</span>
                    <p className="font-medium text-green-900">{formData.court_name}</p>
                  </div>
                  {formData.client_role && (
                    <div>
                      <span className="text-green-700 text-xs">의뢰인 지위</span>
                      <p className="font-medium text-green-900">{formData.client_role === 'plaintiff' ? '원고' : '피고'}</p>
                    </div>
                  )}
                </div>
                <p className="mt-2 text-xs text-green-700">
                  나의사건검색에 등록되어 기일/송달 정보가 자동 동기화됩니다.
                </p>
              </>
            ) : (
              // 검색 폼
              <>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-blue-900">대법원 사건 검색 (선택)</h2>
                  <button
                    type="button"
                    onClick={handleScourtSearch}
                    disabled={scourtSearching}
                    className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {scourtSearching ? '검색중...' : '검색'}
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-blue-700 mb-1">사건번호</label>
                    <input
                      type="text"
                      value={formData.court_case_number}
                      onChange={(e) => setFormData({ ...formData, court_case_number: e.target.value })}
                      placeholder="2024드단12345"
                      className="w-full px-3 py-2 text-sm border border-blue-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div className="relative">
                    <label className="block text-xs font-medium text-blue-700 mb-1">법원</label>
                    <input
                      type="text"
                      value={formData.court_name}
                      onChange={(e) => {
                        setFormData({ ...formData, court_name: e.target.value })
                        setShowCourtDropdown(true)
                      }}
                      onFocus={() => setShowCourtDropdown(true)}
                      onBlur={() => setTimeout(() => setShowCourtDropdown(false), 150)}
                      placeholder="검색 또는 선택..."
                      className="w-full px-3 py-2 text-sm border border-blue-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                    {showCourtDropdown && filteredCourts.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {filteredCourts.map(c => (
                          <div
                            key={c.code}
                            className="px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 text-gray-900"
                            onMouseDown={() => {
                              setFormData({ ...formData, court_name: c.name })
                              setShowCourtDropdown(false)
                            }}
                          >
                            {c.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-blue-700 mb-1">당사자이름</label>
                    <input
                      id="scourt-party-name"
                      type="text"
                      value={scourtSearchPartyName}
                      onChange={(e) => setScourtSearchPartyName(e.target.value)}
                      placeholder="의뢰인 또는 상대방 이름"
                      className="w-full px-3 py-2 text-sm border border-blue-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                  </div>
                </div>
                {scourtSearchError && (
                  <p className="mt-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                    ⚠️ {scourtSearchError}
                  </p>
                )}
                <p className="mt-2 text-xs text-blue-600">
                  검색 성공 시 법원, 판사, 원고/피고 정보가 자동으로 입력됩니다.
                </p>
              </>
            )}
          </div>

          {/* Client Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">의뢰인 정보 *</h2>
              <button
                type="button"
                onClick={() => setIsNewClient(!isNewClient)}
                className="text-xs text-sage-600 hover:text-sage-700 font-medium"
              >
                {isNewClient ? '기존 의뢰인 선택' : '+ 새 의뢰인 입력'}
              </button>
            </div>

            {!isNewClient ? (
              <select
                required={!isNewClient}
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sage-500"
              >
                <option value="">선택하세요</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} {client.phone ? `(${client.phone})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-gray-50 rounded border border-gray-200">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    이름 *
                  </label>
                  <input
                    type="text"
                    required={isNewClient}
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sage-500"
                    placeholder="홍길동"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    연락처 *
                  </label>
                  <input
                    type="tel"
                    required={isNewClient}
                    value={formData.client_phone}
                    onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sage-500"
                    placeholder="010-1234-5678"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    이메일
                  </label>
                  <input
                    type="email"
                    value={formData.client_email}
                    onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sage-500"
                    placeholder="example@email.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    생년월일
                  </label>
                  <input
                    type="date"
                    value={formData.client_birth_date}
                    onChange={(e) => setFormData({ ...formData, client_birth_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sage-500"
                    style={{ colorScheme: 'light' }}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    주소
                  </label>
                  <input
                    type="text"
                    value={formData.client_address}
                    onChange={(e) => setFormData({ ...formData, client_address: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sage-500"
                    placeholder="경기도 평택시..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            <Link
              href="/cases"
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
            >
              취소
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-sage-600 rounded hover:bg-sage-700 disabled:opacity-50 transition-colors"
            >
              {loading ? '등록 중...' : '사건 등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
