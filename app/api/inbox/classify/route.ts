/**
 * Inbox API - Auto-classify files
 * @description POST /api/inbox/classify - Trigger auto-classification for files
 * @body { fileIds: string[] } | { all: true }
 * @returns Classification results with confidence scores
 */

import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/api/with-tenant';
import { createAdminClient } from '@/lib/supabase/admin';
import { classifyWithGemini, type GeminiClassificationResult } from '@/lib/r2/gemini-classifier';
import { parseFilename, type ParsedFilename } from '@/lib/r2/filename-parser';

export interface ClassificationRequest {
  fileIds?: string[];
  all?: boolean;
}

export interface ClassificationResult {
  fileId: string;
  fileName: string;
  success: boolean;
  docType: string;
  suggestedName: string;
  targetFolder: string;
  confidence: number;
  reasoning: string;
  method: 'rule-based' | 'ai' | 'failed';
  error?: string;
}

export interface ClassifyResponse {
  success: boolean;
  results: ClassificationResult[];
  totalProcessed: number;
  successCount: number;
  error?: string;
}

/**
 * Rule-based classification using filename-parser
 */
function ruleBasedClassification(fileName: string): ClassificationResult | null {
  const parsed: ParsedFilename = parseFilename(fileName);

  if (!parsed.docType) {
    return null;
  }

  // Map docType to folder structure
  const folderMap: Record<string, string> = {
    brief: 'briefs/',
    evidence: 'evidence/',
    court_doc: 'court_docs/',
    reference: 'reference/',
  };

  const targetFolder = folderMap[parsed.docType] || 'reference/';

  // Generate suggested name
  let suggestedName = fileName;
  if (parsed.exhibitInfo) {
    const { side, subParty, number, subNumber } = parsed.exhibitInfo;
    suggestedName = `${side}${subParty || ''} 제${number}${subNumber ? `-${subNumber}` : ''}호증`;
  } else if (parsed.docSubtype) {
    const subtypeMap: Record<string, string> = {
      complaint: '소장',
      answer: '답변서',
      brief: '준비서면',
      appeal_brief: '항소이유서',
      judgment: '판결',
      decision: '결정',
      order: '명령',
    };
    suggestedName = subtypeMap[parsed.docSubtype] || fileName;
  }

  return {
    fileId: '',
    fileName,
    success: true,
    docType: parsed.docType,
    suggestedName,
    targetFolder,
    confidence: 0.8,
    reasoning: 'Rule-based classification from filename pattern',
    method: 'rule-based',
  };
}

/**
 * Classify a single file
 */
async function classifyFile(
  fileId: string,
  fileName: string,
  caseId?: string
): Promise<ClassificationResult> {
  try {
    // Step 1: Try rule-based classification
    const ruleResult = ruleBasedClassification(fileName);

    if (ruleResult && ruleResult.confidence >= 0.7) {
      return {
        ...ruleResult,
        fileId,
      };
    }

    // Step 2: Fallback to AI classification
    const aiResult: GeminiClassificationResult | null = await classifyWithGemini({
      filename: fileName,
      caseId,
    });

    if (aiResult) {
      return {
        fileId,
        fileName,
        success: true,
        docType: aiResult.docType,
        suggestedName: aiResult.suggestedName,
        targetFolder: aiResult.targetFolder,
        confidence: aiResult.confidence,
        reasoning: aiResult.reasoning,
        method: 'ai',
      };
    }

    // Step 3: Classification failed
    return {
      fileId,
      fileName,
      success: false,
      docType: 'reference',
      suggestedName: fileName,
      targetFolder: 'reference/',
      confidence: 0.3,
      reasoning: 'Classification failed, defaulting to reference',
      method: 'failed',
      error: 'Both rule-based and AI classification failed',
    };
  } catch (error) {
    console.error('[Classify] File classification error:', { fileId, error });
    return {
      fileId,
      fileName,
      success: false,
      docType: 'reference',
      suggestedName: fileName,
      targetFolder: 'reference/',
      confidence: 0,
      reasoning: 'Classification error',
      method: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

const handler = async (
  request: NextRequest,
  context: { tenant: { tenantId: string } }
) => {
  try {
    const body: ClassificationRequest = await request.json();
    const tenantId = context.tenant.tenantId;

    const supabase = createAdminClient();

    // Determine which files to classify
    let filesToClassify: Array<{ id: string; file_name: string; case_id: string | null }> = [];

    if (body.all) {
      // Get all unclassified files for this tenant
      const { data: tenantCases } = await supabase
        .from('legal_cases')
        .select('id')
        .eq('tenant_id', tenantId);

      if (!tenantCases || tenantCases.length === 0) {
        return NextResponse.json<ClassifyResponse>({
          success: true,
          results: [],
          totalProcessed: 0,
          successCount: 0,
        });
      }

      const caseIds = tenantCases.map((c) => c.id);

      const { data: files, error } = await supabase
        .from('drive_file_classifications')
        .select('id, file_name, case_id')
        .in('case_id', caseIds)
        .or('client_doc_type.is.null,client_visible.eq.false');

      if (error) {
        throw error;
      }

      filesToClassify = files || [];
    } else if (body.fileIds && body.fileIds.length > 0) {
      // Get specific files
      const { data: files, error } = await supabase
        .from('drive_file_classifications')
        .select('id, file_name, case_id')
        .in('id', body.fileIds);

      if (error) {
        throw error;
      }

      filesToClassify = files || [];
    } else {
      return NextResponse.json<ClassifyResponse>(
        {
          success: false,
          results: [],
          totalProcessed: 0,
          successCount: 0,
          error: 'Either fileIds or all=true must be specified',
        },
        { status: 400 }
      );
    }

    // Classify each file
    const results: ClassificationResult[] = [];

    for (const file of filesToClassify) {
      const result = await classifyFile(file.id, file.file_name, file.case_id || undefined);
      results.push(result);
    }

    const successCount = results.filter((r) => r.success).length;

    const response: ClassifyResponse = {
      success: true,
      results,
      totalProcessed: results.length,
      successCount,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Classify] Unexpected error:', error);
    return NextResponse.json<ClassifyResponse>(
      {
        success: false,
        results: [],
        totalProcessed: 0,
        successCount: 0,
        error: error instanceof Error ? error.message : '서버 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
};

export const POST = withTenant(handler);
