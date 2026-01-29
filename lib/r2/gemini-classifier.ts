/**
 * AI-based file classification using Google Gemini
 *
 * This is the fallback classifier when rule-based classification fails.
 * Uses Gemini to intelligently analyze Korean legal document filenames
 * and suggest appropriate classification.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';
const RATE_LIMIT_PER_MINUTE = 60;
const REQUEST_TIMEOUT_MS = 30000;

// Cost tracking (approximate for gemini-2.0-flash-exp)
const COST_PER_1K_INPUT_TOKENS = 0.00001; // $0.01 per 1M tokens
const COST_PER_1K_OUTPUT_TOKENS = 0.00003; // $0.03 per 1M tokens

// Types
export interface GeminiClassificationResult {
  docType: 'brief' | 'evidence' | 'court_doc' | 'reference';
  suggestedName: string;
  targetFolder: string;
  confidence: number;
  reasoning: string;
}

interface UsageRecord {
  timestamp: Date;
  tokens: number;
  cost: number;
}

// Rate limiting state
const requestTimestamps: number[] = [];

// Initialize Gemini client
let genAI: GoogleGenerativeAI | null = null;
if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
}

// Initialize Supabase client for cost tracking
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

/**
 * Build the prompt for Gemini to classify a legal document
 */
function buildPrompt(filename: string, context?: string): string {
  return `You are an expert in Korean legal document classification for law firms.

Analyze this filename and classify it appropriately.

Filename: ${filename}
${context ? `Context: ${context}` : ''}

Your task:
1. Identify the document type:
   - "brief": 준비서면, 소장, 답변서, 변론요지서 등 변호사가 작성한 서면
   - "evidence": 증거자료, 증거설명서, 진술서, 각종 증빙서류
   - "court_doc": 법원이 발행한 문서 (판결문, 결정문, 명령, 송달 등)
   - "reference": 참고자료, 법령, 판례, 내부메모 등

2. Suggest a normalized display name (keep Korean characters, improve readability)

3. Suggest a target folder path following this structure:
   - briefs/ (준비서면)
   - evidence/ (증거자료)
   - court_docs/ (법원문서)
   - reference/ (참고자료)

4. Provide confidence score (0.0-1.0)

5. Explain your reasoning briefly

Respond ONLY with valid JSON in this exact format:
{
  "docType": "brief|evidence|court_doc|reference",
  "suggestedName": "normalized filename",
  "targetFolder": "folder_path/",
  "confidence": 0.95,
  "reasoning": "brief explanation"
}`;
}

/**
 * Parse Gemini's JSON response
 */
function parseGeminiResponse(response: string): GeminiClassificationResult {
  // Try to extract JSON from markdown code blocks if present
  let jsonStr = response.trim();

  // Remove markdown code blocks
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1];
  }

  // Parse JSON
  const parsed = JSON.parse(jsonStr);

  // Validate required fields
  if (!parsed.docType || !parsed.suggestedName || !parsed.targetFolder) {
    throw new Error('Invalid response format: missing required fields');
  }

  // Validate docType
  const validDocTypes = ['brief', 'evidence', 'court_doc', 'reference'];
  if (!validDocTypes.includes(parsed.docType)) {
    throw new Error(`Invalid docType: ${parsed.docType}`);
  }

  return {
    docType: parsed.docType,
    suggestedName: parsed.suggestedName,
    targetFolder: parsed.targetFolder,
    confidence: parsed.confidence || 0.5,
    reasoning: parsed.reasoning || 'No reasoning provided'
  };
}

/**
 * Check rate limit and update request timestamps
 * @returns true if request is allowed, false if rate limited
 */
function checkRateLimit(): boolean {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;

  // Remove old timestamps
  while (requestTimestamps.length > 0 && requestTimestamps[0] < oneMinuteAgo) {
    requestTimestamps.shift();
  }

  // Check if we're at the limit
  if (requestTimestamps.length >= RATE_LIMIT_PER_MINUTE) {
    return false;
  }

  // Record this request
  requestTimestamps.push(now);
  return true;
}

/**
 * Track usage to Supabase for cost monitoring
 */
async function trackUsage(inputTokens: number, outputTokens: number): Promise<void> {
  try {
    const cost =
      (inputTokens / 1000) * COST_PER_1K_INPUT_TOKENS +
      (outputTokens / 1000) * COST_PER_1K_OUTPUT_TOKENS;

    const { error } = await supabase
      .from('ai_usage_logs')
      .insert({
        model: GEMINI_MODEL,
        operation: 'file_classification',
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
        cost,
        timestamp: new Date().toISOString()
      });

    if (error) {
      console.error('Failed to track usage:', error);
    }
  } catch (error) {
    console.error('Error tracking usage:', error);
  }
}

/**
 * Get monthly usage statistics
 */
export async function getMonthlyUsage(): Promise<{ calls: number; tokens: number; cost: number }> {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('ai_usage_logs')
      .select('total_tokens, cost')
      .eq('operation', 'file_classification')
      .gte('timestamp', startOfMonth.toISOString());

    if (error) {
      console.error('Failed to get monthly usage:', error);
      return { calls: 0, tokens: 0, cost: 0 };
    }

    const calls = data?.length || 0;
    const tokens = data?.reduce((sum, record) => sum + (record.total_tokens || 0), 0) || 0;
    const cost = data?.reduce((sum, record) => sum + (record.cost || 0), 0) || 0;

    return { calls, tokens, cost };
  } catch (error) {
    console.error('Error getting monthly usage:', error);
    return { calls: 0, tokens: 0, cost: 0 };
  }
}

/**
 * Classify a file using Gemini AI
 *
 * @param params - Classification parameters
 * @returns Classification result or null if classification fails
 */
export async function classifyWithGemini(params: {
  filename: string;
  caseId?: string;
  context?: string;
}): Promise<GeminiClassificationResult | null> {
  // Check if API key is configured
  if (!GEMINI_API_KEY || !genAI) {
    console.warn('Gemini API key not configured, skipping AI classification');
    return null;
  }

  // Check rate limit
  if (!checkRateLimit()) {
    console.warn('Rate limit exceeded (60 requests/minute), skipping AI classification');
    return null;
  }

  try {
    // Get the model
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    // Build the prompt
    const prompt = buildPrompt(params.filename, params.context);

    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), REQUEST_TIMEOUT_MS);
    });

    // Make the request with timeout
    const resultPromise = model.generateContent(prompt);
    const result = await Promise.race([resultPromise, timeoutPromise]);

    const response = await result.response;
    const text = response.text();

    // Parse the response
    const classification = parseGeminiResponse(text);

    // Track usage
    const usageMetadata = response.usageMetadata;
    if (usageMetadata) {
      await trackUsage(
        usageMetadata.promptTokenCount || 0,
        usageMetadata.candidatesTokenCount || 0
      );
    }

    console.log('Gemini classification:', {
      filename: params.filename,
      docType: classification.docType,
      confidence: classification.confidence
    });

    return classification;

  } catch (error: unknown) {
    // Extract error properties with type guards
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStatus = (error as { status?: number })?.status;

    // Handle specific error types
    if (errorMessage === 'Request timeout') {
      console.error('Gemini request timeout after 30s');
      return null;
    }

    // Handle API errors
    if (errorStatus === 401) {
      console.error('Invalid Gemini API key');
      return null;
    }

    if (errorStatus === 429) {
      // Rate limit from Google's side - try exponential backoff
      console.warn('Gemini API rate limit, attempting retry with backoff');

      for (let attempt = 1; attempt <= 3; attempt++) {
        const backoffMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        await new Promise(resolve => setTimeout(resolve, backoffMs));

        try {
          const model = genAI!.getGenerativeModel({ model: GEMINI_MODEL });
          const prompt = buildPrompt(params.filename, params.context);
          const result = await model.generateContent(prompt);
          const response = await result.response;
          const text = response.text();

          const classification = parseGeminiResponse(text);

          // Track usage
          const usageMetadata = response.usageMetadata;
          if (usageMetadata) {
            await trackUsage(
              usageMetadata.promptTokenCount || 0,
              usageMetadata.candidatesTokenCount || 0
            );
          }

          return classification;

        } catch (retryError) {
          console.error(`Retry attempt ${attempt} failed:`, retryError);
          if (attempt === 3) {
            return null;
          }
        }
      }
    }

    if (errorStatus === 500) {
      console.error('Gemini server error:', errorMessage);
      return null;
    }

    // Unknown error
    console.error('Gemini classification error:', error);
    return null;
  }
}

/**
 * Check if Gemini is available and configured
 */
export function isGeminiAvailable(): boolean {
  return !!(GEMINI_API_KEY && genAI);
}
