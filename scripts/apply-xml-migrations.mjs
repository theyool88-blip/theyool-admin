/**
 * XML 마이그레이션 적용 스크립트
 *
 * Supabase REST API를 통해 SQL 함수를 생성합니다.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

// SQL statements to execute
const SQL_STATEMENTS = [
  // Migration 1: XML Download Lock Functions
  `CREATE OR REPLACE FUNCTION try_acquire_xml_download_slot(p_xml_path text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing_content text;
  v_existing_updated timestamptz;
  v_rows integer;
BEGIN
  SELECT xml_content, updated_at INTO v_existing_content, v_existing_updated
  FROM scourt_xml_cache
  WHERE xml_path = p_xml_path;

  IF FOUND THEN
    IF v_existing_content IS NOT NULL AND v_existing_content != '__DOWNLOADING__' THEN
      RETURN 'already_cached';
    END IF;

    IF v_existing_content = '__DOWNLOADING__' THEN
      IF v_existing_updated < now() - interval '5 minutes' THEN
        UPDATE scourt_xml_cache
        SET xml_content = '__DOWNLOADING__', updated_at = now()
        WHERE xml_path = p_xml_path;
        RETURN 'acquired';
      END IF;
      RETURN 'downloading';
    END IF;
  END IF;

  INSERT INTO scourt_xml_cache (xml_path, xml_content, updated_at)
  VALUES (p_xml_path, '__DOWNLOADING__', now())
  ON CONFLICT (xml_path) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows > 0 THEN
    RETURN 'acquired';
  END IF;

  SELECT xml_content INTO v_existing_content
  FROM scourt_xml_cache
  WHERE xml_path = p_xml_path;

  IF v_existing_content = '__DOWNLOADING__' THEN
    RETURN 'downloading';
  ELSE
    RETURN 'already_cached';
  END IF;
END;
$$`,

  `CREATE OR REPLACE FUNCTION complete_xml_download(
  p_xml_path text,
  p_xml_content text,
  p_case_type text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE scourt_xml_cache
  SET xml_content = p_xml_content,
      case_type = p_case_type,
      updated_at = now()
  WHERE xml_path = p_xml_path
    AND (xml_content = '__DOWNLOADING__' OR xml_content IS NULL);

  RETURN FOUND;
END;
$$`,

  `CREATE OR REPLACE FUNCTION abort_xml_download(p_xml_path text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM scourt_xml_cache
  WHERE xml_path = p_xml_path
    AND xml_content = '__DOWNLOADING__';
END;
$$`,

  `CREATE OR REPLACE FUNCTION cleanup_stale_xml_downloads()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM scourt_xml_cache
  WHERE xml_content = '__DOWNLOADING__'
    AND updated_at < now() - interval '5 minutes';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$`,

  // Migration 2: Rate Limiter Table
  `CREATE TABLE IF NOT EXISTS scourt_rate_limit (
  id integer PRIMARY KEY DEFAULT 1,
  concurrent_count integer DEFAULT 0,
  last_updated timestamptz DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
)`,

  `INSERT INTO scourt_rate_limit (id, concurrent_count) VALUES (1, 0)
ON CONFLICT (id) DO NOTHING`,

  `ALTER TABLE scourt_rate_limit ENABLE ROW LEVEL SECURITY`,

  `DROP POLICY IF EXISTS "scourt_rate_limit_select_authenticated" ON scourt_rate_limit`,

  `CREATE POLICY "scourt_rate_limit_select_authenticated"
ON scourt_rate_limit
FOR SELECT
TO authenticated
USING (true)`,

  `DROP POLICY IF EXISTS "scourt_rate_limit_all_service" ON scourt_rate_limit`,

  `CREATE POLICY "scourt_rate_limit_all_service"
ON scourt_rate_limit
FOR ALL
TO service_role
USING (true)
WITH CHECK (true)`,

  `CREATE OR REPLACE FUNCTION try_acquire_scourt_slot(max_concurrent integer DEFAULT 3)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acquired boolean := false;
BEGIN
  UPDATE scourt_rate_limit
  SET concurrent_count = 0
  WHERE id = 1
    AND last_updated < now() - interval '5 minutes'
    AND concurrent_count > 0;

  UPDATE scourt_rate_limit
  SET concurrent_count = concurrent_count + 1,
      last_updated = now()
  WHERE id = 1 AND concurrent_count < max_concurrent;

  IF FOUND THEN
    acquired := true;
  END IF;

  RETURN acquired;
END;
$$`,

  `CREATE OR REPLACE FUNCTION release_scourt_slot()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE scourt_rate_limit
  SET concurrent_count = GREATEST(concurrent_count - 1, 0),
      last_updated = now()
  WHERE id = 1;
END;
$$`,

  `CREATE OR REPLACE FUNCTION get_scourt_concurrent_count()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT concurrent_count FROM scourt_rate_limit WHERE id = 1;
$$`,
];

async function executeSQL(sql, description) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({ sql }),
  });

  if (!response.ok) {
    // Try direct SQL via postgres function
    const pgResponse = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Prefer': 'return=representation',
      },
    });
    return { success: false, error: 'exec_sql not available' };
  }

  return { success: true };
}

async function main() {
  console.log('🚀 Starting XML migrations...\n');
  console.log(`📍 Supabase URL: ${SUPABASE_URL}\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < SQL_STATEMENTS.length; i++) {
    const sql = SQL_STATEMENTS[i];
    const preview = sql.substring(0, 60).replace(/\n/g, ' ') + '...';
    process.stdout.write(`[${i + 1}/${SQL_STATEMENTS.length}] ${preview}`);

    try {
      const result = await executeSQL(sql);
      if (result.success) {
        console.log(' ✅');
        successCount++;
      } else {
        console.log(' ⚠️ (may need manual apply)');
        errorCount++;
      }
    } catch (error) {
      console.log(` ❌ ${error.message}`);
      errorCount++;
    }
  }

  console.log(`\n📊 Results: ${successCount} success, ${errorCount} need manual apply`);

  if (errorCount > 0) {
    console.log('\n📋 To apply manually, run this SQL in Supabase Dashboard > SQL Editor:');
    console.log('   File: /Users/hskim/luseed/.omc/combined-xml-migrations.sql');
  }
}

main().catch(console.error);
