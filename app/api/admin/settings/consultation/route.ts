/**
 * Admin Consultation Settings API
 * ADMIN ONLY - Requires authentication
 *
 * GET: 모든 상담 설정 조회
 * PUT: 설정 업데이트
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth/auth';
import { createAdminClient } from '@/lib/supabase/server';

// 설정 타입 정의
export interface PhoneAvailabilitySettings {
  enabled: boolean;
  fallback_to_form: boolean;
  fallback_delay_seconds: number;
  business_hours: {
    start: string;  // "09:00"
    end: string;    // "18:00"
    lunch_start?: string;  // "12:00"
    lunch_end?: string;    // "13:00"
    days: number[]; // [1,2,3,4,5] = Mon-Fri
  };
  holiday_fallback: boolean;
}

export interface ModalConfigSettings {
  phone_modal_enabled: boolean;
  form_modal_enabled: boolean;
  show_countdown: boolean;
  countdown_seconds: number;
  auto_fallback_on_busy: boolean;
}

export interface ConsultationTypeSettings {
  callback: { enabled: boolean; label: string };
  visit: { enabled: boolean; label: string };
  video: { enabled: boolean; label: string };
  info: { enabled: boolean; label: string };
}

export interface ConsultationSettings {
  phone_availability: PhoneAvailabilitySettings;
  modal_config: ModalConfigSettings;
  consultation_types: ConsultationTypeSettings;
}

/**
 * GET /api/admin/settings/consultation
 * Get all consultation settings (ADMIN ONLY)
 */
export async function GET() {
  try {
    // Check authentication
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createAdminClient();

    const { data, error } = await supabase
      .from('consultation_settings')
      .select('setting_key, setting_value, description, updated_at');

    if (error) {
      console.error('Error fetching consultation settings:', error);
      return NextResponse.json(
        { error: '설정을 불러오는데 실패했습니다' },
        { status: 500 }
      );
    }

    // Convert array to object keyed by setting_key
    const settings: Record<string, unknown> = {};
    data?.forEach((row) => {
      settings[row.setting_key] = {
        value: row.setting_value,
        description: row.description,
        updated_at: row.updated_at
      };
    });

    return NextResponse.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('GET /api/admin/settings/consultation error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/settings/consultation
 * Update consultation settings (ADMIN ONLY)
 *
 * Body: { setting_key: string, setting_value: object }
 */
export async function PUT(request: NextRequest) {
  try {
    // Check authentication
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { setting_key, setting_value } = body;

    if (!setting_key || !setting_value) {
      return NextResponse.json(
        { error: 'setting_key와 setting_value가 필요합니다' },
        { status: 400 }
      );
    }

    // Validate setting_key
    const validKeys = ['phone_availability', 'modal_config', 'consultation_types'];
    if (!validKeys.includes(setting_key)) {
      return NextResponse.json(
        { error: '유효하지 않은 설정 키입니다' },
        { status: 400 }
      );
    }

    const supabase = await createAdminClient();

    const { data, error } = await supabase
      .from('consultation_settings')
      .update({
        setting_value,
        updated_at: new Date().toISOString()
      })
      .eq('setting_key', setting_key)
      .select()
      .single();

    if (error) {
      console.error('Error updating consultation settings:', error);
      return NextResponse.json(
        { error: '설정 업데이트에 실패했습니다' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        setting_key: data.setting_key,
        value: data.setting_value,
        updated_at: data.updated_at
      }
    });
  } catch (error) {
    console.error('PUT /api/admin/settings/consultation error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
