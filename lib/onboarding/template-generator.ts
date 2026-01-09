/**
 * 표준 엑셀 템플릿 생성 및 다운로드
 */

import * as XLSX from 'xlsx'

// 템플릿 컬럼 정의
const TEMPLATE_COLUMNS = [
  { key: 'court_case_number', label: '사건번호', required: true, example: '2024드단25547' },
  { key: 'court_name', label: '법원명', required: true, example: '수원가정법원' },
  { key: 'client_name', label: '의뢰인명', required: true, example: '김철수' },
  { key: 'case_name', label: '사건명', required: false, example: '이혼 및 위자료' },
  { key: 'case_type', label: '사건유형', required: false, example: '이혼' },
  { key: 'opponent_name', label: '상대방명', required: false, example: '이영희' },
  { key: 'assigned_lawyer', label: '담당변호사', required: false, example: '박변호사' },
  { key: 'assigned_staff', label: '담당직원', required: false, example: '최직원' },
  { key: 'contract_date', label: '계약일', required: false, example: '2024-01-15' },
  { key: 'retainer_fee', label: '착수금', required: false, example: '5000000' },
  { key: 'success_fee_agreement', label: '성공보수약정', required: false, example: '승소시 10%' },
  { key: 'client_phone', label: '의뢰인연락처', required: false, example: '010-1234-5678' },
  { key: 'client_email', label: '의뢰인이메일', required: false, example: 'client@email.com' },
  { key: 'notes', label: '메모', required: false, example: '급한 사건' },
]

/**
 * 표준 엑셀 템플릿 생성 및 다운로드
 */
export function downloadTemplate(): void {
  // 워크북 생성
  const wb = XLSX.utils.book_new()

  // 데이터 시트 생성
  const headers = TEMPLATE_COLUMNS.map(col => col.label)
  const exampleRow = TEMPLATE_COLUMNS.map(col => col.example)

  const dataSheetData = [headers, exampleRow]
  const dataSheet = XLSX.utils.aoa_to_sheet(dataSheetData)

  // 컬럼 너비 설정
  dataSheet['!cols'] = TEMPLATE_COLUMNS.map(col => ({
    wch: Math.max(col.label.length * 2, col.example.length + 2, 12)
  }))

  XLSX.utils.book_append_sheet(wb, dataSheet, '사건목록')

  // 안내 시트 생성
  const guideData = [
    ['사건 대량 등록 템플릿 안내'],
    [''],
    ['필수 필드 (반드시 입력)'],
    ['- 사건번호: 법원 사건번호 (예: 2024드단25547)'],
    ['- 법원명: 사건을 담당하는 법원 (예: 수원가정법원)'],
    ['- 의뢰인명: 의뢰인 이름 (예: 김철수)'],
    [''],
    ['선택 필드 (빈칸 가능)'],
    ['- 사건명: 사건 제목 (없으면 자동 생성)'],
    ['- 사건유형: 이혼, 상속, 민사 등'],
    ['- 상대방명: 상대방 이름'],
    ['- 담당변호사: 담당 변호사 이름 또는 ID'],
    ['- 담당직원: 담당 직원 이름 또는 ID'],
    ['- 계약일: YYYY-MM-DD 형식'],
    ['- 착수금: 숫자만 입력 (원 단위)'],
    ['- 성공보수약정: 성공 보수 내용'],
    ['- 의뢰인연락처: 신규 의뢰인 생성 시 사용'],
    ['- 의뢰인이메일: 신규 의뢰인 생성 시 사용'],
    ['- 메모: 기타 메모 사항'],
    [''],
    ['주의사항'],
    ['- 첫 번째 행은 헤더이므로 삭제하지 마세요'],
    ['- 예시 데이터(2행)는 삭제하고 실제 데이터를 입력하세요'],
    ['- 기존 의뢰인이 있으면 이름으로 자동 매칭됩니다'],
    ['- 중복 사건번호+법원명 처리 옵션을 선택할 수 있습니다'],
  ]

  const guideSheet = XLSX.utils.aoa_to_sheet(guideData)
  guideSheet['!cols'] = [{ wch: 60 }]

  XLSX.utils.book_append_sheet(wb, guideSheet, '안내')

  // 다운로드
  XLSX.writeFile(wb, '사건등록_템플릿.xlsx')
}

/**
 * CSV 템플릿 다운로드
 */
export function downloadCSVTemplate(): void {
  const headers = TEMPLATE_COLUMNS.map(col => col.label).join(',')
  const exampleRow = TEMPLATE_COLUMNS.map(col => col.example).join(',')

  const csvContent = `${headers}\n${exampleRow}`

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = '사건등록_템플릿.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
