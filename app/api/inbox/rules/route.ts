/**
 * Inbox API - Classification rules management
 * @description GET /api/inbox/rules - List tenant's classification rules
 * @description POST /api/inbox/rules - Create new classification rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/api/with-tenant';
import { createAdminClient } from '@/lib/supabase/admin';

export interface ClassificationCondition {
  field: 'filename' | 'folder_path' | 'mime_type' | 'file_size';
  operator: 'contains' | 'starts_with' | 'ends_with' | 'equals' | 'regex' | 'greater_than' | 'less_than';
  value: string | number;
}

export interface ClassificationAction {
  type: 'set_doc_type' | 'set_folder' | 'set_client_visible' | 'set_client_doc_type';
  value: string | boolean;
}

export interface ClassificationRule {
  id: string;
  tenant_id: string;
  name: string;
  priority: number;
  enabled: boolean;
  conditions: ClassificationCondition[];
  actions: ClassificationAction[];
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface RulesListResponse {
  success: boolean;
  rules: ClassificationRule[];
  totalCount: number;
  error?: string;
}

export interface CreateRuleRequest {
  name: string;
  priority?: number;
  enabled?: boolean;
  conditions: ClassificationCondition[];
  actions: ClassificationAction[];
}

export interface CreateRuleResponse {
  success: boolean;
  rule?: ClassificationRule;
  error?: string;
}

const handler = async (
  request: NextRequest,
  context: { tenant: { tenantId: string } }
) => {
  const tenantId = context.tenant.tenantId;
  const supabase = createAdminClient();

  // Get current user
  const { createClient } = await import('@/lib/supabase/server');
  const userSupabase = await createClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  const userId = user?.id;

  // GET - List rules
  if (request.method === 'GET') {
    try {
      // Check if classification_rules table exists
      // For now, return empty array as the table doesn't exist yet
      // TODO: Create classification_rules table in migration

      const response: RulesListResponse = {
        success: true,
        rules: [],
        totalCount: 0,
      };

      return NextResponse.json(response);
    } catch (error) {
      console.error('[Rules] List error:', error);
      return NextResponse.json<RulesListResponse>(
        {
          success: false,
          rules: [],
          totalCount: 0,
          error: '규칙 목록 조회 중 오류가 발생했습니다.',
        },
        { status: 500 }
      );
    }
  }

  // POST - Create rule
  if (request.method === 'POST') {
    try {
      const body: CreateRuleRequest = await request.json();
      const { name, priority = 100, enabled = true, conditions, actions } = body;

      // Validate required fields
      if (!name || !conditions || !actions || conditions.length === 0 || actions.length === 0) {
        return NextResponse.json<CreateRuleResponse>(
          {
            success: false,
            error: 'name, conditions, and actions are required',
          },
          { status: 400 }
        );
      }

      // Validate conditions
      for (const condition of conditions) {
        if (!condition.field || !condition.operator || condition.value === undefined) {
          return NextResponse.json<CreateRuleResponse>(
            {
              success: false,
              error: 'Invalid condition format',
            },
            { status: 400 }
          );
        }
      }

      // Validate actions
      for (const action of actions) {
        if (!action.type || action.value === undefined) {
          return NextResponse.json<CreateRuleResponse>(
            {
              success: false,
              error: 'Invalid action format',
            },
            { status: 400 }
          );
        }
      }

      // TODO: Insert rule into classification_rules table
      // For now, return mock response
      const mockRule: ClassificationRule = {
        id: 'mock-id',
        tenant_id: tenantId,
        name,
        priority,
        enabled,
        conditions,
        actions,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: userId || '',
      };

      return NextResponse.json<CreateRuleResponse>({
        success: true,
        rule: mockRule,
      });
    } catch (error) {
      console.error('[Rules] Create error:', error);
      return NextResponse.json<CreateRuleResponse>(
        {
          success: false,
          error: error instanceof Error ? error.message : '규칙 생성 중 오류가 발생했습니다.',
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
};

export const GET = withTenant(handler);
export const POST = withTenant(handler);
