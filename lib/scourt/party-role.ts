import type { CaseGeneralData } from '@/lib/scourt/api-client'

export type InferredClientRole = 'plaintiff' | 'defendant'

function matchesMaskedName(maskedName: string, fullName: string): boolean {
  if (!maskedName || !fullName) return false
  const masked = maskedName.replace(/O/g, '')
  const first = fullName.charAt(0)
  const last = fullName.charAt(fullName.length - 1)

  if (masked.length >= 2) {
    return masked.charAt(0) === first && masked.charAt(masked.length - 1) === last
  }
  return masked.charAt(0) === first
}

export function inferClientRoleFromGeneralData(
  generalData: CaseGeneralData | null | undefined,
  partyName: string
): InferredClientRole | null {
  if (!generalData || !partyName) return null

  const plaintiffName = generalData.aplNm || ''
  const defendantName = generalData.rspNm || ''

  if (matchesMaskedName(plaintiffName, partyName)) {
    return 'plaintiff'
  }
  if (matchesMaskedName(defendantName, partyName)) {
    return 'defendant'
  }
  return null
}
