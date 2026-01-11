import crypto from 'crypto'
import type { CaseSnapshot, DocumentItem, HearingInfo, ProgressItem } from '@/lib/scourt/change-detector'

export function formatScourtDate(dateStr?: string | null): string {
  if (!dateStr) return ''

  if (dateStr.includes('.')) {
    return dateStr
  }

  if (dateStr.includes('-')) {
    const [year, month, day] = dateStr.split('-')
    if (year && month && day) {
      return `${year}.${month.padStart(2, '0')}.${day.padStart(2, '0')}`
    }
  }

  const compact = dateStr.replace(/\D/g, '')
  if (compact.length === 8) {
    return `${compact.slice(0, 4)}.${compact.slice(4, 6)}.${compact.slice(6, 8)}`
  }

  return dateStr
}

export function formatScourtTime(timeStr?: string | null): string {
  if (!timeStr) return ''

  if (timeStr.includes(':')) {
    const [hour, minute] = timeStr.split(':')
    if (hour && minute) {
      return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
    }
    return timeStr
  }

  const compact = timeStr.replace(/\D/g, '')
  if (compact.length === 4) {
    return `${compact.slice(0, 2)}:${compact.slice(2, 4)}`
  }

  return timeStr
}

export function generateProgressHash(
  progress: Array<{ prcdDt?: string; prcdNm?: string; prcdRslt?: string }>
): string {
  const normalized = (progress || []).map((item) => ({
    date: formatScourtDate(item.prcdDt || ''),
    content: (item.prcdNm || '').trim(),
    result: (item.prcdRslt || '').trim(),
  }))

  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex')
}

export function generateGeneralHash(params: {
  basicInfo: Record<string, unknown>
  hearings: unknown[]
  documents: unknown[]
  parties?: unknown[]
  representatives?: unknown[]
}): string {
  const normalized = {
    basicInfo: params.basicInfo,
    hearings: params.hearings,
    documents: params.documents,
    parties: params.parties || [],
    representatives: params.representatives || [],
  }

  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex')
}

export function toChangeDetectorSnapshot(params: {
  basicInfo: Record<string, unknown>
  hearings: Array<Record<string, unknown>>
  progress: Array<Record<string, unknown>>
  documents?: Array<Record<string, unknown>>
  lowerCourt?: Array<Record<string, unknown>>
  relatedCases?: Array<Record<string, unknown>>
}): CaseSnapshot {
  const basicInfo: Record<string, string> = {}
  for (const [key, value] of Object.entries(params.basicInfo || {})) {
    if (typeof value === 'string') {
      basicInfo[key] = value
    }
  }

  const hearings: HearingInfo[] = (params.hearings || []).map((item) => ({
    date: formatScourtDate(
      (item.trmDt as string) || (item.date as string) || ''
    ),
    time: formatScourtTime(
      (item.trmHm as string) || (item.time as string) || ''
    ),
    type: (item.trmNm as string) || (item.type as string) || '',
    location: (item.trmPntNm as string) || (item.location as string) || '',
    result: (item.rslt as string) || (item.result as string) || '',
  }))

  const progress: ProgressItem[] = (params.progress || []).map((item) => ({
    date: formatScourtDate(
      (item.prcdDt as string) || (item.date as string) || ''
    ),
    content: (item.prcdNm as string) || (item.content as string) || '',
    result: (item.prcdRslt as string) || (item.result as string) || '',
  }))

  const documents: DocumentItem[] = (params.documents || []).map((item) => ({
    date: formatScourtDate(
      (item.ofdocRcptYmd as string) || (item.date as string) || ''
    ),
    content:
      (item.content as string) ||
      (item.content1 as string) ||
      (item.content2 as string) ||
      (item.content3 as string) ||
      '',
  }))

  const lowerCourt = (params.lowerCourt || []).map((item) => ({
    court: (item.courtName as string) || (item.cortNm as string) || '',
    caseNo: (item.caseNo as string) || (item.userCsNo as string) || '',
  }))

  const relatedCases = (params.relatedCases || []).map((item) => ({
    caseNo: (item.caseNo as string) || (item.userCsNo as string) || '',
    caseName: (item.caseName as string) || (item.reltCsCortNm as string) || '',
    relation: (item.relation as string) || (item.reltCsDvsNm as string) || '',
  }))

  return {
    basicInfo,
    hearings,
    progress,
    documents,
    lowerCourt,
    relatedCases,
  }
}
