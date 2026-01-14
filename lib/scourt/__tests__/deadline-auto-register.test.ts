import { describe, it, expect } from 'vitest'
import { getCaseCategoryFromNumber, getCaseTypeInfo } from '../deadline-auto-register'

/**
 * isZeroHourService 테스트용 헬퍼 함수
 * 실제 함수는 모듈 내부 함수이므로 동일 로직을 테스트용으로 구현
 */
function isZeroHourService(result: string | undefined | null): boolean {
  if (!result) return false
  return result.includes('0시 도달')
}

describe('deadline-auto-register', () => {
  describe('isZeroHourService - 0시 도달 감지', () => {
    it('"0시 도달" 패턴 감지', () => {
      expect(isZeroHourService('2025.04.08 0시 도달')).toBe(true)
      expect(isZeroHourService('0시 도달')).toBe(true)
    })

    it('전자송달 의제 케이스', () => {
      // SCOURT에서 전자송달 미열람 7일 후 0시 도달로 표시
      expect(isZeroHourService('2025.04.15 0시 도달')).toBe(true)
    })

    it('공시송달 케이스', () => {
      // 공시송달도 0시 도달로 표시
      expect(isZeroHourService('2025.04.22 0시 도달')).toBe(true)
    })

    it('일반 송달 (0시 도달 아님)', () => {
      expect(isZeroHourService('2025.04.08 도달')).toBe(false)
      expect(isZeroHourService('2025.04.08 14:30 도달')).toBe(false)
      expect(isZeroHourService('2025.04.08')).toBe(false)
    })

    it('빈 값 또는 null 처리', () => {
      expect(isZeroHourService(null)).toBe(false)
      expect(isZeroHourService(undefined)).toBe(false)
      expect(isZeroHourService('')).toBe(false)
    })

    it('유사 패턴 (0시 도달 아님)', () => {
      expect(isZeroHourService('0시 도착')).toBe(false)
      expect(isZeroHourService('12시 도달')).toBe(false)
      expect(isZeroHourService('24시 도달')).toBe(false)
    })
  })

  describe('getCaseCategoryFromNumber - 사건 유형 판별', () => {
    it('민사 사건', () => {
      expect(getCaseCategoryFromNumber('2024가단12345')).toBe('civil')
      expect(getCaseCategoryFromNumber('2024가합67890')).toBe('civil')
      expect(getCaseCategoryFromNumber('2024나12345')).toBe('civil')
    })

    it('형사 사건', () => {
      expect(getCaseCategoryFromNumber('2024고단12345')).toBe('criminal')
      expect(getCaseCategoryFromNumber('2024고합67890')).toBe('criminal')
      expect(getCaseCategoryFromNumber('2024노12345')).toBe('criminal')
    })

    it('가사 사건', () => {
      expect(getCaseCategoryFromNumber('2024드단12345')).toBe('family')
      expect(getCaseCategoryFromNumber('2024드합67890')).toBe('family')
    })

    it('가사비송 사건', () => {
      expect(getCaseCategoryFromNumber('2024르12345')).toBe('family')
      expect(getCaseCategoryFromNumber('2024브12345')).toBe('family')
    })

    it('행정 사건', () => {
      expect(getCaseCategoryFromNumber('2024구합12345')).toBe('administrative')
      expect(getCaseCategoryFromNumber('2024누12345')).toBe('administrative')
    })

    it('잘못된 형식', () => {
      expect(getCaseCategoryFromNumber('invalid')).toBe(null)
      expect(getCaseCategoryFromNumber('')).toBe(null)
    })
  })

  describe('getCaseTypeInfo - 사건 유형 정보', () => {
    it('민사 사건 정보', () => {
      const info = getCaseTypeInfo('2024가단12345')
      expect(info.caseTypeCode).toBe('가단')
      expect(info.category).toBe('civil')
      expect(info.appealDeadline?.deadlineType).toBe('DL_APPEAL')
      expect(info.appealDeadline?.days).toBe(14)
    })

    it('형사 사건 정보', () => {
      const info = getCaseTypeInfo('2024고단12345')
      expect(info.caseTypeCode).toBe('고단')
      expect(info.category).toBe('criminal')
      expect(info.appealDeadline?.deadlineType).toBe('DL_CRIMINAL_APPEAL')
      expect(info.appealDeadline?.days).toBe(7)
    })

    it('가사소송 사건 정보', () => {
      const info = getCaseTypeInfo('2024드단12345')
      expect(info.caseTypeCode).toBe('드단')
      expect(info.category).toBe('family')
      expect(info.appealDeadline?.deadlineType).toBe('DL_APPEAL')
      expect(info.appealDeadline?.days).toBe(14)
    })

    it('가사비송 사건 정보 (르)', () => {
      const info = getCaseTypeInfo('2024르12345')
      expect(info.caseTypeCode).toBe('르')
      expect(info.appealDeadline?.deadlineType).toBe('DL_FAMILY_NONLIT')
      expect(info.appealDeadline?.days).toBe(14)
    })
  })
})
