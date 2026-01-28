/**
 * Inbox API - Single classification rule management
 * @description GET /api/inbox/rules/[id] - Get single rule
 * @description PUT /api/inbox/rules/[id] - Update rule
 * @description DELETE /api/inbox/rules/[id] - Delete rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/api/with-tenant';
import { createAdminClient } from '@/lib/supabase/admin';
import type {
  ClassificationRule,
  ClassificationCondition,
  ClassificationAction,
} from '../route';

export interface GetRuleResponse {
  success: boolean;
  rule?: ClassificationRule;
  error?: string;
}

export interface UpdateRuleRequest {
  name?: string;
  priority?: number;
  enabled?: boolean;
  conditions?: ClassificationCondition[];
  actions?: ClassificationAction[];
}

export interface UpdateRuleResponse {
  success: boolean;
  rule?: ClassificationRule;
  error?: string;
}

export interface DeleteRuleResponse {
  success: boolean;
  message?: string;
  error?: string;
}

const handler = async (
  request: NextRequest,
  context: { tenant: { tenantId: string }; params?: Record<string, string> }
) => {
  const tenantId = context.tenant.tenantId;
  const ruleId = context.params?.id;

  if (!ruleId) {
    return NextResponse.json(
      { success: false, error: 'Rule ID is required' },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // GET - Get single rule
  if (request.method === 'GET') {
    try {
      // TODO: Query classification_rules table
      // For now, return mock response

      return NextResponse.json<GetRuleResponse>(
        {
          success: false,
          error: '규칙을 찾을 수 없습니다.',
        },
        { status: 404 }
      );
    } catch (error) {
      console.error('[Rule] Get error:', error);
      return NextResponse.json<GetRuleResponse>(
        {
          success: false,
          error: '규칙 조회 중 오류가 발생했습니다.',
        },
        { status: 500 }
      );
    }
  }

  // PUT - Update rule
  if (request.method === 'PUT') {
    try {
      const body: UpdateRuleRequest = await request.json();

      // Validate at least one field to update
      if (
        !body.name &&
        body.priority === undefined &&
        body.enabled === undefined &&
        !body.conditions &&
        !body.actions
      ) {
        return NextResponse.json<UpdateRuleResponse>(
          {
            success: false,
            error: 'At least one field must be provided for update',
          },
          { status: 400 }
        );
      }

      // Validate conditions if provided
      if (body.conditions) {
        for (const condition of body.conditions) {
          if (!condition.field || !condition.operator || condition.value === undefined) {
            return NextResponse.json<UpdateRuleResponse>(
              {
                success: false,
                error: 'Invalid condition format',
              },
              { status: 400 }
            );
          }
        }
      }

      // Validate actions if provided
      if (body.actions) {
        for (const action of body.actions) {
          if (!action.type || action.value === undefined) {
            return NextResponse.json<UpdateRuleResponse>(
              {
                success: false,
                error: 'Invalid action format',
              },
              { status: 400 }
            );
          }
        }
      }

      // TODO: Update classification_rules table
      // For now, return mock response

      return NextResponse.json<UpdateRuleResponse>(
        {
          success: false,
          error: '규칙을 찾을 수 없습니다.',
        },
        { status: 404 }
      );
    } catch (error) {
      console.error('[Rule] Update error:', error);
      return NextResponse.json<UpdateRuleResponse>(
        {
          success: false,
          error: error instanceof Error ? error.message : '규칙 수정 중 오류가 발생했습니다.',
        },
        { status: 500 }
      );
    }
  }

  // DELETE - Delete rule
  if (request.method === 'DELETE') {
    try {
      // TODO: Delete from classification_rules table
      // For now, return mock response

      return NextResponse.json<DeleteRuleResponse>(
        {
          success: false,
          error: '규칙을 찾을 수 없습니다.',
        },
        { status: 404 }
      );
    } catch (error) {
      console.error('[Rule] Delete error:', error);
      return NextResponse.json<DeleteRuleResponse>(
        {
          success: false,
          error: '규칙 삭제 중 오류가 발생했습니다.',
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
export const PUT = withTenant(handler);
export const DELETE = withTenant(handler);
