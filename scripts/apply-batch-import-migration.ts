/**
 * Apply batch import queue migration
 *
 * Run with: npx tsx scripts/apply-batch-import-migration.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyMigration() {
  console.log('Applying batch import queue migration...')

  // 1. Create batch_import_jobs table
  const { error: error1 } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS batch_import_jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        batch_id UUID NOT NULL,
        row_index INTEGER NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'queued',
        priority INTEGER NOT NULL DEFAULT 0,
        payload JSONB NOT NULL,
        result JSONB,
        last_error TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        backoff_until TIMESTAMPTZ,
        lock_token TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        started_at TIMESTAMPTZ,
        finished_at TIMESTAMPTZ,
        requested_by UUID REFERENCES auth.users(id)
      );
    `
  })

  if (error1 && !error1.message.includes('already exists')) {
    console.error('Error creating batch_import_jobs:', error1)
  } else {
    console.log('✓ batch_import_jobs table created or already exists')
  }

  // 2. Create batch_import_summaries table
  const { error: error2 } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS batch_import_summaries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        batch_id UUID UNIQUE NOT NULL,
        total_rows INTEGER NOT NULL,
        processed_rows INTEGER NOT NULL DEFAULT 0,
        success_count INTEGER NOT NULL DEFAULT 0,
        failed_count INTEGER NOT NULL DEFAULT 0,
        skipped_count INTEGER NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        options JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        requested_by UUID REFERENCES auth.users(id)
      );
    `
  })

  if (error2 && !error2.message.includes('already exists')) {
    console.error('Error creating batch_import_summaries:', error2)
  } else {
    console.log('✓ batch_import_summaries table created or already exists')
  }

  console.log('Migration complete!')
}

// Alternative: Direct table creation using REST API
async function createTablesDirectly() {
  console.log('Creating tables using direct SQL...')

  // First check if tables already exist
  const { data: existingTables, error: checkError } = await supabase
    .from('batch_import_jobs')
    .select('id')
    .limit(1)

  if (!checkError) {
    console.log('Tables already exist!')
    return
  }

  if (checkError.code !== '42P01') { // 42P01 = relation does not exist
    console.log('Tables might already exist or other error:', checkError.message)
  }

  console.log('Tables do not exist. Please apply the migration manually via Supabase Dashboard SQL Editor.')
  console.log('Migration file: supabase/migrations/20260122_batch_import_queue.sql')
}

createTablesDirectly().catch(console.error)
