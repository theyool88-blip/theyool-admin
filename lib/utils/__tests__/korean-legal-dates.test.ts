import { describe, it, expect } from 'vitest'
import {
  calculateLegalDeadlineString,
  isNonBusinessDay,
  isPublicHoliday,
  isSaturday,
  isSunday,
  getNextBusinessDay,
  KOREAN_PUBLIC_HOLIDAYS_2025,
  KOREAN_PUBLIC_HOLIDAYS_2026,
} from '../korean-legal-dates'

describe('korean-legal-dates', () => {
  describe('기본 날짜 함수', () => {
    it('isSaturday: 토요일 확인', () => {
      expect(isSaturday(new Date('2025-01-11'))).toBe(true) // 토요일
      expect(isSaturday(new Date('2025-01-12'))).toBe(false) // 일요일
      expect(isSaturday(new Date('2025-01-13'))).toBe(false) // 월요일
    })

    it('isSunday: 일요일 확인', () => {
      expect(isSunday(new Date('2025-01-12'))).toBe(true) // 일요일
      expect(isSunday(new Date('2025-01-11'))).toBe(false) // 토요일
      expect(isSunday(new Date('2025-01-13'))).toBe(false) // 월요일
    })

    it('isPublicHoliday: 공휴일 확인', () => {
      expect(isPublicHoliday(new Date('2025-01-01'))).toBe(true) // 신정
      expect(isPublicHoliday(new Date('2025-03-01'))).toBe(true) // 삼일절
      expect(isPublicHoliday(new Date('2025-01-12'))).toBe(true) // 일요일
      expect(isPublicHoliday(new Date('2025-01-13'))).toBe(false) // 평일
    })

    it('isNonBusinessDay: 비영업일 확인', () => {
      expect(isNonBusinessDay(new Date('2025-01-11'))).toBe(true) // 토요일
      expect(isNonBusinessDay(new Date('2025-01-12'))).toBe(true) // 일요일
      expect(isNonBusinessDay(new Date('2025-01-01'))).toBe(true) // 신정
      expect(isNonBusinessDay(new Date('2025-01-13'))).toBe(false) // 평일
    })
  })

  describe('getNextBusinessDay', () => {
    it('평일이면 그대로 반환', () => {
      const result = getNextBusinessDay(new Date('2025-01-13')) // 월요일
      expect(result.toISOString().split('T')[0]).toBe('2025-01-13')
    })

    it('토요일이면 월요일 반환', () => {
      const result = getNextBusinessDay(new Date('2025-01-11')) // 토요일
      expect(result.toISOString().split('T')[0]).toBe('2025-01-13') // 월요일
    })

    it('일요일이면 월요일 반환', () => {
      const result = getNextBusinessDay(new Date('2025-01-12')) // 일요일
      expect(result.toISOString().split('T')[0]).toBe('2025-01-13') // 월요일
    })

    it('공휴일이면 다음 영업일 반환', () => {
      const result = getNextBusinessDay(new Date('2025-01-01')) // 신정 (수요일)
      expect(result.toISOString().split('T')[0]).toBe('2025-01-02') // 목요일
    })
  })

  describe('calculateLegalDeadline - 민사 항소기간 (14일)', () => {
    it('평일 송달 → 평일 만료', () => {
      // 2025-04-08 (화요일) 송달 → 14일 → 2025-04-22 (화요일)
      const result = calculateLegalDeadlineString('2025-04-08', 14, false)
      expect(result).toBe('2025-04-22')
    })

    it('말일이 토요일 → 월요일로 연장 (민법 제161조)', () => {
      // 2025-03-07 (금) + 14일 = 3/21 (금) → 맞음
      const result = calculateLegalDeadlineString('2025-03-07', 14, false)
      expect(result).toBe('2025-03-21') // 금요일, 평일
    })

    it('말일이 토요일인 경우 연장', () => {
      // 2025-03-01 (토) + 14일 = 3/15 (토) → 3/17 (월)
      const result = calculateLegalDeadlineString('2025-03-01', 14, false)
      expect(result).toBe('2025-03-17') // 월요일로 연장
    })

    it('말일이 일요일인 경우 연장', () => {
      // 2025-03-02 (일) + 14일 = 3/16 (일) → 3/17 (월)
      const result = calculateLegalDeadlineString('2025-03-02', 14, false)
      expect(result).toBe('2025-03-17') // 월요일로 연장
    })
  })

  describe('calculateLegalDeadline - 형사 항소기간 (7일)', () => {
    it('선고일 기준 7일 계산', () => {
      // 2025-01-13 (월) + 7일 = 1/20 (월)
      const result = calculateLegalDeadlineString('2025-01-13', 7, false)
      expect(result).toBe('2025-01-20')
    })

    it('말일이 토요일인 경우 연장', () => {
      // 2025-01-11 (토) + 7일 = 1/18 (토) → 1/20 (월)
      const result = calculateLegalDeadlineString('2025-01-11', 7, false)
      expect(result).toBe('2025-01-20')
    })
  })

  describe('calculateLegalDeadline - 전자송달 (0시 의제)', () => {
    it('전자송달 시 1일 단축', () => {
      // 2025-04-08 일반 송달 → 4/22
      const normal = calculateLegalDeadlineString('2025-04-08', 14, false)
      expect(normal).toBe('2025-04-22')

      // 2025-04-08 전자송달 (0시 의제) → 4/21 (1일 단축)
      const electronic = calculateLegalDeadlineString('2025-04-08', 14, true)
      expect(electronic).toBe('2025-04-21')
    })

    it('전자송달 + 말일 공휴일 → 익영업일로 연장', () => {
      // 전자송달로 말일이 토요일이 되는 케이스
      // 2025-03-08 (토) + 13일 = 3/21 (금, 평일)
      const result = calculateLegalDeadlineString('2025-03-08', 14, true)
      expect(result).toBe('2025-03-21')
    })
  })

  describe('calculateLegalDeadline - 공휴일 연휴 케이스', () => {
    it('추석 연휴: 연휴 후 첫 평일로 연장', () => {
      // 2025-09-22 (월) + 14일 = 10/6 (월, 추석)
      // 10/6 추석, 10/7 추석연휴, 10/8 추석 대체공휴일, 10/9 한글날
      // → 10/10 (금) 첫 평일
      const result = calculateLegalDeadlineString('2025-09-22', 14, false)
      expect(result).toBe('2025-10-10')
    })

    it('어린이날 대체공휴일', () => {
      // 2025-04-21 (월) + 14일 = 5/5 (어린이날, 월)
      // 5/5 어린이날, 5/6 대체공휴일 → 5/7 (수)
      const result = calculateLegalDeadlineString('2025-04-21', 14, false)
      expect(result).toBe('2025-05-07')
    })

    it('설날 연휴', () => {
      // 2025-01-14 (화) + 14일 = 1/28 (설날 연휴, 화)
      // 1/28, 1/29, 1/30 설날 연휴 → 1/31 (금)
      const result = calculateLegalDeadlineString('2025-01-14', 14, false)
      expect(result).toBe('2025-01-31')
    })
  })

  describe('2026년 공휴일 처리', () => {
    it('2026년 설날 연휴', () => {
      // 2026-02-02 (월) + 14일 = 2/16 (설날 연휴)
      // 2/16, 2/17, 2/18 설날 연휴 → 2/19 (목)
      const result = calculateLegalDeadlineString('2026-02-02', 14, false)
      expect(result).toBe('2026-02-19')
    })

    it('2026년 삼일절 대체공휴일', () => {
      // 2026-03-01 (일) 삼일절, 2026-03-02 (월) 대체공휴일
      // 2026-02-15 (일) + 14일 = 3/1 (일, 삼일절) → 3/2 (대체) → 3/3 (화)
      const result = calculateLegalDeadlineString('2026-02-15', 14, false)
      expect(result).toBe('2026-03-03')
    })
  })

  describe('공휴일 데이터 검증', () => {
    it('2025년 공휴일 개수 확인', () => {
      expect(KOREAN_PUBLIC_HOLIDAYS_2025.length).toBeGreaterThanOrEqual(15)
    })

    it('2026년 공휴일 개수 확인', () => {
      expect(KOREAN_PUBLIC_HOLIDAYS_2026.length).toBeGreaterThanOrEqual(15)
    })

    it('2025년 주요 공휴일 포함 확인', () => {
      expect(KOREAN_PUBLIC_HOLIDAYS_2025).toContain('2025-01-01') // 신정
      expect(KOREAN_PUBLIC_HOLIDAYS_2025).toContain('2025-03-01') // 삼일절
      expect(KOREAN_PUBLIC_HOLIDAYS_2025).toContain('2025-08-15') // 광복절
      expect(KOREAN_PUBLIC_HOLIDAYS_2025).toContain('2025-12-25') // 성탄절
    })
  })

  describe('엣지 케이스', () => {
    it('days가 0인 경우', () => {
      const result = calculateLegalDeadlineString('2025-01-13', 0, false)
      expect(result).toBe('2025-01-13') // 평일
    })

    it('days가 1인 경우 (즉시항고 등)', () => {
      const result = calculateLegalDeadlineString('2025-01-13', 1, false)
      expect(result).toBe('2025-01-14')
    })

    it('매우 긴 기간 (40일 항소이유서)', () => {
      // 2025-01-13 (월) + 40일 = 2/22 (토) → 2/24 (월)
      const result = calculateLegalDeadlineString('2025-01-13', 40, false)
      expect(result).toBe('2025-02-24')
    })
  })
})
