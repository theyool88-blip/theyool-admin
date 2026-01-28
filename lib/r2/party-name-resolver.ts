import { createClient } from "@/lib/supabase/server";

/**
 * Party Name Resolver
 *
 * Extracts party names from uploaded file names to help unmask SCOURT data.
 * Used in Phase 4 of party schema improvement plan.
 */

// Common legal terms to exclude from name extraction
const LEGAL_TERMS = new Set([
  '원고', '피고', '법원', '재판', '판사', '변호사', '증인',
  '준비서면', '진술서', '증거', '서증', '증명서', '확인서',
  '소장', '답변서', '의견서', '신청서', '통지서', '결정문',
  '판결문', '호증', '제출', '자료', '문서', '사본', '첨부',
]);

/**
 * Validates if a string is a valid Korean name
 * - 2-4 Korean characters
 * - Not a common legal term
 */
function isValidKoreanName(name: string): boolean {
  // Must be 2-4 Korean characters
  const koreanNamePattern = /^[가-힣]{2,4}$/;
  if (!koreanNamePattern.test(name)) {
    return false;
  }

  // Must not be a common legal term
  if (LEGAL_TERMS.has(name)) {
    return false;
  }

  return true;
}

/**
 * Extracts party name from a filename using multiple patterns
 *
 * Patterns:
 * 1. (원고 홍길동) or (피고 김철수) -> extract name after role
 * 2. _홍길동_ or _김철수_ -> extract name between underscores
 * 3. 홍길동_진술서 -> extract name before document type
 *
 * @param filename - The filename to parse (without extension)
 * @returns Extracted party name or null if none found
 *
 * @example
 * extractPartyName("갑 제1호증 홍길동_진술서") // "홍길동"
 * extractPartyName("20251126_준비서면(피고 김철수)") // "김철수"
 * extractPartyName("_박영희_확인서") // "박영희"
 */
export function extractPartyName(filename: string): string | null {
  // Remove file extension if present
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '');

  // Pattern 1: (원고 홍길동) or (피고 김철수)
  const rolePattern = /\([^\)]*?\s*([가-힣]{2,4})\)/g;
  let match;
  while ((match = rolePattern.exec(nameWithoutExt)) !== null) {
    const candidate = match[1];
    if (isValidKoreanName(candidate)) {
      return candidate;
    }
  }

  // Pattern 2: _홍길동_ (name between underscores)
  const underscorePattern = /_([가-힣]{2,4})_/g;
  while ((match = underscorePattern.exec(nameWithoutExt)) !== null) {
    const candidate = match[1];
    if (isValidKoreanName(candidate)) {
      return candidate;
    }
  }

  // Pattern 3: 홍길동_진술서 (name before document type keywords)
  const docTypes = ['진술서', '진술', '확인서', '증명서', '의견서', '신청서', '서면'];
  for (const docType of docTypes) {
    const beforeDocPattern = new RegExp(`([가-힣]{2,4})_${docType}`, 'g');
    while ((match = beforeDocPattern.exec(nameWithoutExt)) !== null) {
      const candidate = match[1];
      if (isValidKoreanName(candidate)) {
        return candidate;
      }
    }
  }

  // Pattern 4: Simple underscore split - check all parts
  const parts = nameWithoutExt.split('_');
  for (const part of parts) {
    const trimmed = part.trim();
    if (isValidKoreanName(trimmed)) {
      return trimmed;
    }
  }

  return null;
}

/**
 * Resolves party names from uploaded file names for a case
 *
 * Queries r2_files table and extracts party names from filenames.
 * Returns a map of scourt_party_index to real names found in files.
 *
 * @param caseId - The case UUID
 * @returns Map of party index to extracted real name
 *
 * @example
 * const names = await resolvePartyFromFiles("case-uuid");
 * // Map { 1 => "홍길동", 2 => "김철수" }
 */
export async function resolvePartyFromFiles(
  caseId: string
): Promise<Map<number, string>> {
  const supabase = await createClient();
  const partyNameMap = new Map<number, string>();

  // Query r2_files for this case
  const { data: files, error } = await supabase
    .from('r2_files')
    .select('file_name, scourt_party_index')
    .eq('case_id', caseId)
    .not('scourt_party_index', 'is', null);

  if (error) {
    console.error('Error fetching files for party name resolution:', error);
    return partyNameMap;
  }

  if (!files || files.length === 0) {
    return partyNameMap;
  }

  // Extract names from each file
  for (const file of files) {
    const extractedName = extractPartyName(file.file_name);

    if (extractedName && file.scourt_party_index !== null) {
      // If we already have a name for this index, keep the first one found
      // (could be enhanced to handle conflicts differently)
      if (!partyNameMap.has(file.scourt_party_index)) {
        partyNameMap.set(file.scourt_party_index, extractedName);
      }
    }
  }

  return partyNameMap;
}

/**
 * Gets unmasked party names by combining case_parties data and file-based extraction
 *
 * Priority:
 * 1. case_parties.name (if not masked/placeholder)
 * 2. File-based extraction
 *
 * @param caseId - The case UUID
 * @returns Array of party name mappings with masked name, real name, and index
 *
 * @example
 * const parties = await getUnmaskedPartyNames("case-uuid");
 * // [
 * //   { index: 1, maskedName: "갑", realName: "홍길동" },
 * //   { index: 2, maskedName: "을", realName: "김철수" }
 * // ]
 */
export async function getUnmaskedPartyNames(
  caseId: string
): Promise<{ index: number; maskedName: string; realName: string | null }[]> {
  const supabase = await createClient();

  // Get parties from case_parties table
  const { data: parties, error } = await supabase
    .from('case_parties')
    .select('scourt_party_index, name, role')
    .eq('case_id', caseId)
    .not('scourt_party_index', 'is', null)
    .order('scourt_party_index');

  if (error) {
    console.error('Error fetching parties:', error);
    return [];
  }

  if (!parties || parties.length === 0) {
    return [];
  }

  // Get file-based name extraction
  const fileBasedNames = await resolvePartyFromFiles(caseId);

  // Combine results with priority: case_parties.name > file-based
  return parties.map((party: { scourt_party_index: number | null; name: string | null; role: string | null }) => {
    const index = party.scourt_party_index!;
    const maskedName = party.name || `당사자${index}`;

    // Check if case_parties.name is a real name (not masked placeholder)
    let realName: string | null = null;

    if (party.name && isValidKoreanName(party.name)) {
      // case_parties.name looks like a real name
      realName = party.name;
    } else {
      // Try file-based extraction
      realName = fileBasedNames.get(index) || null;
    }

    return {
      index,
      maskedName,
      realName,
    };
  });
}

/**
 * Type guard to check if a party name appears to be masked
 * Common masked patterns: 갑, 을, 병, 정, 당사자1, 당사자2, etc.
 */
export function isMaskedPartyName(name: string): boolean {
  const maskedPatterns = [
    /^[갑을병정무기경신임계]$/,  // Single character masks
    /^당사자\d+$/,                  // 당사자1, 당사자2, etc.
    /^원고\d*$/,                    // 원고, 원고1, etc.
    /^피고\d*$/,                    // 피고, 피고1, etc.
  ];

  return maskedPatterns.some(pattern => pattern.test(name));
}
