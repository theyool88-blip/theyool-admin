/**
 * Korean Legal Document Filename Parser
 *
 * Parses Korean legal document filenames to extract metadata based on
 * Korean court filing conventions.
 *
 * Examples:
 * - "20260115_2024가합12345_갑1.pdf" -> 갑 제1호증.pdf
 * - "준비서면(원고).hwp" -> 준비서면_원고_20260115.hwp
 * - "2024가합12345_을가2-1호증.pdf" -> 을가 제2-1호증.pdf
 */

/**
 * Regular expression patterns for parsing Korean legal document filenames
 */
export const PATTERNS = {
  // Case number pattern: e.g., 2024가합12345
  caseNumber: /(\d{4}[가-힣]{1,3}\d{3,6})/,

  // Date pattern: YYYYMMDD or YYYY-MM-DD
  date: /(\d{8})|(\d{4}-\d{2}-\d{2})/,

  // Exhibit pattern: 갑/을 with optional 가/나, number, and optional sub-number
  // Examples: 갑 제1호증, 을가2-1, 갑1, 을나3-2호증
  exhibit: /([갑을])(?:가|나)?(?:\s*제?\s*)?(\d+)(?:-(\d+))?(?:호증)?/,

  // Brief/pleading pattern
  brief: /준비서면|답변서|소장|항소이유서|상고이유서|항소장|상고장|반소장|참가신청서/,

  // Evidence pattern
  evidence: /호증|증거|자료|증거자료|증명서|확인서/,

  // Court document pattern
  courtDoc: /판결|결정|명령|조서|송달|통지|증명원|등본|송달증명원/,

  // Submitter pattern: (원고), (피고 홍길동), _홍길동_
  submitter: /\((?:원고|피고|제3자)?\s*([가-힣]{2,4})\)|_([가-힣]{2,4})_/,

  // Party indicator pattern
  partyIndicator: /원고|피고|제3자|참가인|보조참가인/
};

/**
 * Document type classification
 */
export type DocType = 'brief' | 'evidence' | 'court_doc' | 'reference' | null;

/**
 * Document subtype classification
 */
export type DocSubtype =
  | 'complaint' // 소장
  | 'answer' // 답변서
  | 'brief' // 준비서면
  | 'appeal_brief' // 항소이유서
  | 'exhibit' // 호증
  | 'judgment' // 판결
  | 'decision' // 결정
  | 'order' // 명령
  | 'record' // 조서
  | 'notice' // 송달/통지
  | 'certificate' // 증명원
  | null;

/**
 * Exhibit information
 */
export interface ExhibitInfo {
  side: '갑' | '을';
  subParty?: '가' | '나';
  number: number;
  subNumber?: number;
}

/**
 * Parsed filename metadata
 */
export interface ParsedFilename {
  /** Original filename */
  original: string;
  /** Extracted case number */
  caseNumber?: string;
  /** Parsed date */
  parsedDate?: Date;
  /** Document type */
  docType?: DocType;
  /** Document subtype */
  docSubtype?: DocSubtype;
  /** Exhibit information */
  exhibitInfo?: ExhibitInfo;
  /** Document submitter name */
  submitter?: string;
  /** Party role (원고, 피고, etc.) */
  partyRole?: string;
  /** File extension */
  extension?: string;
}

/**
 * Extracts case number from filename
 *
 * @param filename - The filename to parse
 * @returns Case number or null if not found
 *
 * @example
 * extractCaseNumber("2024가합12345_갑1.pdf") // "2024가합12345"
 */
export function extractCaseNumber(filename: string): string | null {
  const match = filename.match(PATTERNS.caseNumber);
  return match ? match[1] : null;
}

/**
 * Extracts date from filename
 *
 * @param filename - The filename to parse
 * @returns Date object or null if not found
 *
 * @example
 * extractDate("20260115_갑1.pdf") // Date(2026-01-15)
 * extractDate("2026-01-15_갑1.pdf") // Date(2026-01-15)
 */
export function extractDate(filename: string): Date | null {
  const match = filename.match(PATTERNS.date);
  if (!match) return null;

  const dateStr = match[1] || match[2];
  if (!dateStr) return null;

  // Handle YYYYMMDD format
  if (dateStr.length === 8) {
    const year = parseInt(dateStr.substring(0, 4), 10);
    const month = parseInt(dateStr.substring(4, 6), 10);
    const day = parseInt(dateStr.substring(6, 8), 10);

    // Validate date
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }

    return new Date(year, month - 1, day);
  }

  // Handle YYYY-MM-DD format
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);

    // Validate date
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }

    return new Date(year, month - 1, day);
  }

  return null;
}

/**
 * Extracts exhibit information from filename
 *
 * @param filename - The filename to parse
 * @returns Exhibit information or null if not found
 *
 * @example
 * extractExhibit("갑 제1호증.pdf") // { side: '갑', number: 1 }
 * extractExhibit("을가2-1호증.pdf") // { side: '을', subParty: '가', number: 2, subNumber: 1 }
 */
export function extractExhibit(filename: string): ExhibitInfo | null {
  // More comprehensive exhibit pattern
  const exhibitPattern = /([갑을])([가나])?(?:\s*제?\s*)?(\d+)(?:-(\d+))?(?:호증)?/;
  const match = filename.match(exhibitPattern);

  if (!match) return null;

  const side = match[1] as '갑' | '을';
  const subParty = match[2] as '가' | '나' | undefined;
  const number = parseInt(match[3], 10);
  const subNumber = match[4] ? parseInt(match[4], 10) : undefined;

  return {
    side,
    subParty,
    number,
    subNumber
  };
}

/**
 * Detects document type from filename
 *
 * @param filename - The filename to parse
 * @returns Document type or null if unknown
 *
 * @example
 * detectDocType("준비서면.hwp") // "brief"
 * detectDocType("갑1호증.pdf") // "evidence"
 */
export function detectDocType(filename: string): DocType {
  if (PATTERNS.brief.test(filename)) {
    return 'brief';
  }

  if (PATTERNS.evidence.test(filename) || extractExhibit(filename)) {
    return 'evidence';
  }

  if (PATTERNS.courtDoc.test(filename)) {
    return 'court_doc';
  }

  return 'reference';
}

/**
 * Detects document subtype from filename
 *
 * @param filename - The filename to parse
 * @returns Document subtype or null if unknown
 */
export function detectDocSubtype(filename: string): DocSubtype {
  // Brief types
  if (filename.includes('소장')) return 'complaint';
  if (filename.includes('답변서')) return 'answer';
  if (filename.includes('준비서면')) return 'brief';
  if (filename.includes('항소이유서') || filename.includes('상고이유서')) return 'appeal_brief';

  // Evidence types
  if (filename.includes('호증') || extractExhibit(filename)) return 'exhibit';

  // Court document types
  if (filename.includes('판결')) return 'judgment';
  if (filename.includes('결정')) return 'decision';
  if (filename.includes('명령')) return 'order';
  if (filename.includes('조서')) return 'record';
  if (filename.includes('송달') || filename.includes('통지')) return 'notice';
  if (filename.includes('증명원') || filename.includes('등본')) return 'certificate';

  return null;
}

/**
 * Extracts submitter name from filename
 *
 * @param filename - The filename to parse
 * @returns Submitter name or null if not found
 *
 * @example
 * extractSubmitter("준비서면(원고 홍길동).hwp") // "홍길동"
 * extractSubmitter("답변서_김철수_.hwp") // "김철수"
 */
export function extractSubmitter(filename: string): string | null {
  const match = filename.match(PATTERNS.submitter);
  if (!match) return null;

  // Group 1: from parenthesis format (원고 홍길동)
  // Group 2: from underscore format _홍길동_
  return match[1] || match[2] || null;
}

/**
 * Extracts party role from filename
 *
 * @param filename - The filename to parse
 * @returns Party role or null if not found
 *
 * @example
 * extractPartyRole("준비서면(원고).hwp") // "원고"
 * extractPartyRole("답변서(피고).hwp") // "피고"
 */
export function extractPartyRole(filename: string): string | null {
  const match = filename.match(PATTERNS.partyIndicator);
  return match ? match[0] : null;
}

/**
 * Extracts file extension from filename
 *
 * @param filename - The filename to parse
 * @returns File extension (lowercase, without dot) or null
 *
 * @example
 * extractExtension("document.pdf") // "pdf"
 * extractExtension("file.HWP") // "hwp"
 */
export function extractExtension(filename: string): string | null {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === filename.length - 1) {
    return null;
  }
  return filename.substring(lastDot + 1).toLowerCase();
}

/**
 * Parses filename to extract all available metadata
 *
 * @param filename - The filename to parse
 * @returns Parsed filename metadata
 *
 * @example
 * parseFilename("20260115_2024가합12345_갑1.pdf")
 * // {
 * //   original: "20260115_2024가합12345_갑1.pdf",
 * //   caseNumber: "2024가합12345",
 * //   parsedDate: Date(2026-01-15),
 * //   docType: "evidence",
 * //   docSubtype: "exhibit",
 * //   exhibitInfo: { side: '갑', number: 1 },
 * //   extension: "pdf"
 * // }
 */
export function parseFilename(filename: string): ParsedFilename {
  const result: ParsedFilename = {
    original: filename
  };

  // Extract case number
  const caseNumber = extractCaseNumber(filename);
  if (caseNumber) {
    result.caseNumber = caseNumber;
  }

  // Extract date
  const parsedDate = extractDate(filename);
  if (parsedDate) {
    result.parsedDate = parsedDate;
  }

  // Extract exhibit information
  const exhibitInfo = extractExhibit(filename);
  if (exhibitInfo) {
    result.exhibitInfo = exhibitInfo;
  }

  // Detect document type and subtype
  result.docType = detectDocType(filename);
  result.docSubtype = detectDocSubtype(filename);

  // Extract submitter
  const submitter = extractSubmitter(filename);
  if (submitter) {
    result.submitter = submitter;
  }

  // Extract party role
  const partyRole = extractPartyRole(filename);
  if (partyRole) {
    result.partyRole = partyRole;
  }

  // Extract extension
  const extension = extractExtension(filename);
  if (extension) {
    result.extension = extension;
  }

  return result;
}

/**
 * Normalizes filename based on parsed metadata
 *
 * @param original - Original filename
 * @param parsed - Parsed filename metadata
 * @returns Normalized filename
 *
 * @example
 * // Exhibit normalization
 * const parsed = parseFilename("20260115_2024가합12345_갑1.pdf");
 * normalizeFilename(parsed.original, parsed); // "갑 제1호증.pdf"
 *
 * // Brief normalization
 * const parsed2 = parseFilename("준비서면(원고).hwp");
 * normalizeFilename(parsed2.original, parsed2); // "준비서면_원고_20260115.hwp"
 */
export function normalizeFilename(original: string, parsed: ParsedFilename): string {
  const ext = parsed.extension || extractExtension(original) || '';
  const extWithDot = ext ? `.${ext}` : '';

  // Evidence/Exhibit normalization
  if (parsed.exhibitInfo) {
    const { side, subParty, number, subNumber } = parsed.exhibitInfo;
    let normalized = `${side}`;

    if (subParty) {
      normalized += subParty;
    }

    normalized += ` 제${number}`;

    if (subNumber !== undefined) {
      normalized += `-${subNumber}`;
    }

    normalized += `호증${extWithDot}`;
    return normalized;
  }

  // Brief normalization
  if (parsed.docType === 'brief' && parsed.docSubtype) {
    const briefTypes: Record<string, string> = {
      complaint: '소장',
      answer: '답변서',
      brief: '준비서면',
      appeal_brief: '항소이유서'
    };

    let normalized = briefTypes[parsed.docSubtype] || '준비서면';

    if (parsed.submitter) {
      normalized += `_${parsed.submitter}`;
    } else if (parsed.partyRole) {
      normalized += `_${parsed.partyRole}`;
    }

    // Add date if available
    if (parsed.parsedDate) {
      const year = parsed.parsedDate.getFullYear();
      const month = String(parsed.parsedDate.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.parsedDate.getDate()).padStart(2, '0');
      normalized += `_${year}${month}${day}`;
    }

    normalized += extWithDot;
    return normalized;
  }

  // Court document normalization
  if (parsed.docType === 'court_doc' && parsed.docSubtype) {
    const courtDocTypes: Record<string, string> = {
      judgment: '판결',
      decision: '결정',
      order: '명령',
      record: '조서',
      notice: '송달',
      certificate: '증명원'
    };

    let normalized = courtDocTypes[parsed.docSubtype] || '법원문서';

    if (parsed.caseNumber) {
      normalized += `_${parsed.caseNumber}`;
    }

    if (parsed.parsedDate) {
      const year = parsed.parsedDate.getFullYear();
      const month = String(parsed.parsedDate.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.parsedDate.getDate()).padStart(2, '0');
      normalized += `_${year}${month}${day}`;
    }

    normalized += extWithDot;
    return normalized;
  }

  // Default: keep original if no specific normalization applies
  return original;
}

/**
 * Generates a standardized filename for a document
 *
 * @param options - Document metadata
 * @returns Standardized filename
 *
 * @example
 * generateFilename({
 *   docType: 'evidence',
 *   exhibitInfo: { side: '갑', number: 1 },
 *   extension: 'pdf'
 * }) // "갑 제1호증.pdf"
 */
export function generateFilename(options: {
  docType?: DocType;
  docSubtype?: DocSubtype;
  exhibitInfo?: ExhibitInfo;
  caseNumber?: string;
  date?: Date;
  submitter?: string;
  partyRole?: string;
  extension?: string;
}): string {
  const {
    docType,
    docSubtype,
    exhibitInfo,
    caseNumber,
    date,
    submitter,
    partyRole,
    extension
  } = options;

  const ext = extension || 'pdf';
  const extWithDot = `.${ext}`;

  // Evidence/Exhibit generation
  if (exhibitInfo) {
    const { side, subParty, number, subNumber } = exhibitInfo;
    let filename = `${side}`;

    if (subParty) {
      filename += subParty;
    }

    filename += ` 제${number}`;

    if (subNumber !== undefined) {
      filename += `-${subNumber}`;
    }

    filename += `호증${extWithDot}`;
    return filename;
  }

  // Brief generation
  if (docType === 'brief' && docSubtype) {
    const briefTypes: Record<string, string> = {
      complaint: '소장',
      answer: '답변서',
      brief: '준비서면',
      appeal_brief: '항소이유서'
    };

    let filename = briefTypes[docSubtype] || '준비서면';

    if (submitter) {
      filename += `_${submitter}`;
    } else if (partyRole) {
      filename += `_${partyRole}`;
    }

    if (date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      filename += `_${year}${month}${day}`;
    }

    filename += extWithDot;
    return filename;
  }

  // Court document generation
  if (docType === 'court_doc' && docSubtype) {
    const courtDocTypes: Record<string, string> = {
      judgment: '판결',
      decision: '결정',
      order: '명령',
      record: '조서',
      notice: '송달',
      certificate: '증명원'
    };

    let filename = courtDocTypes[docSubtype] || '법원문서';

    if (caseNumber) {
      filename += `_${caseNumber}`;
    }

    if (date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      filename += `_${year}${month}${day}`;
    }

    filename += extWithDot;
    return filename;
  }

  // Generic fallback
  let filename = 'document';

  if (caseNumber) {
    filename += `_${caseNumber}`;
  }

  if (date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    filename += `_${year}${month}${day}`;
  }

  filename += extWithDot;
  return filename;
}
