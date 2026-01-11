/**
 * 사용자별 WMONID 관리
 *
 * - WMONID 발급 및 저장
 * - 만료 30~45일 전 갱신
 * - encCsNo 마이그레이션 (case-migrator 연동)
 */

import { createClient } from '@/lib/supabase';
import { getCaseMigrator } from './case-migrator';

const SCOURT_BASE_URL = 'https://ssgo.scourt.go.kr';
const WMONID_VALIDITY_YEARS = 1;
const DEFAULT_RENEWAL_BEFORE_DAYS = 45; // 만료 30~45일 전 갱신

export interface UserWmonid {
  id: string;
  user_id: string;
  wmonid: string;
  issued_at: string;
  expires_at: string;
  status: 'active' | 'expiring' | 'expired' | 'migrating';
  case_count: number;
}

export class WmonidManager {
  private supabase = createClient();

  /**
   * 사용자의 활성 WMONID 조회
   */
  async getActiveWmonid(userId: string): Promise<UserWmonid | null> {
    const { data, error } = await this.supabase
      .from('scourt_user_wmonid')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return data as UserWmonid;
  }

  /**
   * 새 WMONID 발급
   */
  async issueNewWmonid(userId: string): Promise<UserWmonid | null> {
    console.log(`🔐 사용자 ${userId}에게 새 WMONID 발급 중...`);

    try {
      // 대법원 서버에서 새 WMONID 획득
      const response = await fetch(`${SCOURT_BASE_URL}/ssgo/index.on?cortId=www`);
      const setCookie = response.headers.get('set-cookie');

      const wmonidMatch = setCookie?.match(/WMONID=([^;]+)/);
      const expiresMatch = setCookie?.match(/Expires=([^;]+)/);

      if (!wmonidMatch) {
        console.error('❌ WMONID 획득 실패');
        return null;
      }

      const wmonid = wmonidMatch[1];
      const issuedAt = new Date();

      // 만료일 계산 (Set-Cookie에서 추출 또는 1년 후)
      let expiresAt: Date;
      if (expiresMatch) {
        expiresAt = new Date(expiresMatch[1]);
      } else {
        expiresAt = new Date(issuedAt);
        expiresAt.setFullYear(expiresAt.getFullYear() + WMONID_VALIDITY_YEARS);
      }

      console.log(`  WMONID: ${wmonid}`);
      console.log(`  발급일: ${issuedAt.toISOString()}`);
      console.log(`  만료일: ${expiresAt.toISOString()}`);

      // DB에 저장
      const { data, error } = await this.supabase
        .from('scourt_user_wmonid')
        .insert({
          user_id: userId,
          wmonid: wmonid,
          issued_at: issuedAt.toISOString(),
          expires_at: expiresAt.toISOString(),
          status: 'active',
        })
        .select()
        .single();

      if (error) {
        console.error('❌ WMONID 저장 실패:', error.message);
        return null;
      }

      console.log(`✅ WMONID 발급 완료`);
      return data as UserWmonid;

    } catch (e) {
      console.error('❌ WMONID 발급 에러:', e);
      return null;
    }
  }

  /**
   * 사용자의 WMONID 가져오기 (없으면 발급)
   */
  async getOrCreateWmonid(
    userId: string,
    renewalBeforeDays: number = DEFAULT_RENEWAL_BEFORE_DAYS
  ): Promise<UserWmonid | null> {
    // 기존 활성 WMONID 확인
    let wmonid = await this.getActiveWmonid(userId);

    // 없으면 새로 발급
    if (!wmonid) {
      wmonid = await this.issueNewWmonid(userId);
    }

    // 갱신 필요 여부 확인
    if (wmonid && this.needsRenewal(wmonid, renewalBeforeDays)) {
      console.log(`⚠️ WMONID 갱신 필요 (만료 ${renewalBeforeDays}일 이내)`);
      // 갱신은 별도 프로세스에서 처리 (사건 재등록 필요)
      await this.markAsExpiring(wmonid.id);
    }

    return wmonid;
  }

  /**
   * 갱신 필요 여부 확인 (만료 1개월 이내)
   */
  needsRenewal(wmonid: UserWmonid, renewalBeforeDays: number = DEFAULT_RENEWAL_BEFORE_DAYS): boolean {
    const expiresAt = new Date(wmonid.expires_at);
    const renewalDate = new Date(expiresAt);
    renewalDate.setDate(renewalDate.getDate() - renewalBeforeDays);

    return new Date() >= renewalDate;
  }

  /**
   * 만료 임박 상태로 변경
   */
  async markAsExpiring(wmonidId: string): Promise<void> {
    await this.supabase
      .from('scourt_user_wmonid')
      .update({ status: 'expiring' })
      .eq('id', wmonidId);
  }

  /**
   * 만료 임박 WMONID 목록 조회
   */
  async getExpiringWmonids(renewalBeforeDays: number = DEFAULT_RENEWAL_BEFORE_DAYS): Promise<UserWmonid[]> {
    const renewalDate = new Date();
    renewalDate.setDate(renewalDate.getDate() + renewalBeforeDays);

    const { data, error } = await this.supabase
      .from('scourt_user_wmonid')
      .select('*')
      .eq('status', 'active')
      .lte('expires_at', renewalDate.toISOString());

    if (error) {
      console.error('만료 임박 WMONID 조회 실패:', error.message);
      return [];
    }

    return data as UserWmonid[];
  }

  /**
   * WMONID 갱신 (사건 마이그레이션 포함)
   *
   * 1. 새 WMONID 발급
   * 2. 기존 사건들을 새 WMONID로 재등록
   * 3. 기존 WMONID 만료 처리
   */
  async renewWmonid(oldWmonidId: string): Promise<UserWmonid | null> {
    console.log(`🔄 WMONID 갱신 시작: ${oldWmonidId}`);

    // 기존 WMONID 정보 조회
    const { data: oldWmonid } = await this.supabase
      .from('scourt_user_wmonid')
      .select('*')
      .eq('id', oldWmonidId)
      .single();

    if (!oldWmonid) {
      console.error('❌ 기존 WMONID 조회 실패');
      return null;
    }

    // 마이그레이션 상태로 변경
    await this.supabase
      .from('scourt_user_wmonid')
      .update({ status: 'migrating' })
      .eq('id', oldWmonidId);

    // 새 WMONID 발급
    const newWmonid = await this.issueNewWmonid(oldWmonid.user_id);
    if (!newWmonid) {
      // 실패 시 원래 상태로 복구
      await this.supabase
        .from('scourt_user_wmonid')
        .update({ status: 'expiring' })
        .eq('id', oldWmonidId);
      return null;
    }

    // 기존 WMONID의 사건들 조회
    const { data: cases } = await this.supabase
      .from('scourt_profile_cases')
      .select('case_number, legal_case_id, tenant_id')
      .eq('user_wmonid_id', oldWmonidId);

    const caseCount = cases?.length || 0;
    console.log(`  마이그레이션 대상 사건: ${caseCount}건`);

    // 사건이 없으면 바로 완료
    if (!cases || cases.length === 0) {
      await this.supabase
        .from('scourt_user_wmonid')
        .update({ status: 'expired' })
        .eq('id', oldWmonidId);
      console.log(`✅ WMONID 갱신 완료 (마이그레이션 대상 없음)`);
      return newWmonid;
    }

    // 대표 당사자명 조회
    const migrator = getCaseMigrator();
    const partyName = await migrator.getPartyNameForLegalCase({
      legalCaseId: cases[0].legal_case_id,
      caseNumber: cases[0].case_number,
      tenantId: cases[0].tenant_id,
    });

    if (!partyName) {
      console.warn('⚠️ 당사자명 조회 실패 - 사건을 찾을 수 없습니다');
      // 기존 WMONID를 expiring 상태로 유지 (나중에 배치 처리)
      return newWmonid;
    }

    // 사건 마이그레이션 실행
    console.log(`\n🔄 사건 마이그레이션 시작 (당사자: ${partyName})`);
    const migrationResult = await migrator.migrateCasesForWmonid(
      oldWmonidId,
      newWmonid.wmonid,
      partyName
    );

    // 마이그레이션 결과에 따라 WMONID 상태 업데이트
    if (migrationResult.failedCount === 0) {
      // 모든 사건 마이그레이션 성공 → 기존 WMONID 만료 처리
      await this.supabase
        .from('scourt_user_wmonid')
        .update({ status: 'expired' })
        .eq('id', oldWmonidId);

      console.log(`✅ WMONID 갱신 완료 (${migrationResult.successCount}건 마이그레이션)`);
    } else {
      // 일부 실패 → expiring 상태 유지, 나중에 재시도
      console.warn(`⚠️ 일부 사건 마이그레이션 실패 (성공: ${migrationResult.successCount}, 실패: ${migrationResult.failedCount})`);
      console.warn(`  기존 WMONID는 expiring 상태로 유지됨`);
    }

    return newWmonid;
  }

  /**
   * 만료된 WMONID 정리
   */
  async cleanupExpiredWmonids(): Promise<number> {
    const { data, error } = await this.supabase
      .from('scourt_user_wmonid')
      .update({ status: 'expired' })
      .eq('status', 'active')
      .lt('expires_at', new Date().toISOString())
      .select();

    if (error) {
      console.error('만료 WMONID 정리 실패:', error.message);
      return 0;
    }

    return data?.length || 0;
  }
}

// 싱글톤 인스턴스
let manager: WmonidManager | null = null;

export function getWmonidManager(): WmonidManager {
  if (!manager) {
    manager = new WmonidManager();
  }
  return manager;
}
