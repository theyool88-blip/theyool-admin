/**
 * Simple AI Client for luseed
 *
 * Gemini API를 사용한 간단한 AI 클라이언트
 * Planning, Communication 모듈에서 사용
 *
 * 환경변수:
 * - GOOGLE_AI_API_KEY: Gemini API 키
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIRequestOptions {
  systemPrompt?: string;
  messages: AIMessage[];
  responseFormat?: 'text' | 'json';
  temperature?: number;
  maxTokens?: number;
}

export interface AIResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class SimpleAIClient {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor() {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY 환경변수가 설정되지 않았습니다');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  /**
   * AI에 요청 보내기
   */
  async execute(options: AIRequestOptions): Promise<AIResponse> {
    const { systemPrompt, messages, responseFormat = 'text', temperature = 0.7 } = options;

    // 프롬프트 구성
    let fullPrompt = '';

    if (systemPrompt) {
      fullPrompt += `<system>\n${systemPrompt}\n</system>\n\n`;
    }

    for (const msg of messages) {
      if (msg.role === 'user') {
        fullPrompt += `<user>\n${msg.content}\n</user>\n\n`;
      } else if (msg.role === 'assistant') {
        fullPrompt += `<assistant>\n${msg.content}\n</assistant>\n\n`;
      }
    }

    // JSON 응답 형식 지정
    if (responseFormat === 'json') {
      fullPrompt += '\n\n응답은 반드시 유효한 JSON 형식으로만 출력하세요. 다른 텍스트 없이 JSON만 출력하세요.';
    }

    try {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: options.maxTokens || 4096,
        },
      });

      const response = result.response;
      let content = response.text();

      // JSON 응답인 경우 파싱 시도하여 유효성 검증
      if (responseFormat === 'json') {
        content = this.extractJSON(content);
      }

      return {
        content,
        usage: {
          promptTokens: 0, // Gemini는 토큰 수를 직접 제공하지 않음
          completionTokens: 0,
          totalTokens: 0,
        },
      };
    } catch (error) {
      console.error('[SimpleAIClient] AI 요청 실패:', error);
      throw error;
    }
  }

  /**
   * 간단한 텍스트 완성
   */
  async complete(prompt: string, systemPrompt?: string): Promise<string> {
    const response = await this.execute({
      systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.content;
  }

  /**
   * JSON 응답 요청
   */
  async completeJSON<T>(prompt: string, systemPrompt?: string): Promise<T> {
    const response = await this.execute({
      systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      responseFormat: 'json',
    });

    try {
      return JSON.parse(response.content) as T;
    } catch {
      throw new Error(`JSON 파싱 실패: ${response.content.slice(0, 200)}`);
    }
  }

  /**
   * 응답에서 JSON 추출
   */
  private extractJSON(text: string): string {
    // ```json ... ``` 블록 추출
    const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      return jsonBlockMatch[1].trim();
    }

    // { ... } 또는 [ ... ] 추출
    const jsonMatch = text.match(/[\[{][\s\S]*[\]}]/);
    if (jsonMatch) {
      return jsonMatch[0];
    }

    return text.trim();
  }
}

// 싱글톤 인스턴스
let aiClientInstance: SimpleAIClient | null = null;

export function getAIClient(): SimpleAIClient {
  if (!aiClientInstance) {
    aiClientInstance = new SimpleAIClient();
  }
  return aiClientInstance;
}

/**
 * AI 클라이언트 사용 가능 여부 확인
 */
export function isAIAvailable(): boolean {
  return !!process.env.GOOGLE_AI_API_KEY;
}
