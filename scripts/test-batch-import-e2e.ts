/**
 * End-to-End Test for Batch Import Queue System
 *
 * Tests the complete data flow:
 * 1. Summary insert
 * 2. Jobs insert
 * 3. Dequeue function
 * 4. Job status updates
 * 5. Summary counts update
 * 6. Final completion status
 *
 * Run with: npx tsx scripts/test-batch-import-e2e.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as crypto from 'crypto'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runE2ETest() {
  console.log('='.repeat(60))
  console.log('Batch Import Queue E2E Test')
  console.log('='.repeat(60))

  const testBatchId = crypto.randomUUID()
  const testTenantId = '00000000-0000-0000-0000-000000000000' // Will be replaced with actual tenant

  // Get a real tenant ID first
  console.log('\n[0] Getting a valid tenant ID...')
  const { data: tenants, error: tenantError } = await supabase
    .from('tenants')
    .select('id')
    .limit(1)

  if (tenantError || !tenants || tenants.length === 0) {
    console.error('Failed to get tenant:', tenantError?.message || 'No tenants found')
    console.log('Creating a test without tenant constraint...')
  }

  const tenantId = tenants?.[0]?.id || testTenantId
  console.log(`  Using tenant ID: ${tenantId}`)

  try {
    // Step 1: Create summary
    console.log('\n[1] Creating batch summary...')
    const { data: summary, error: summaryError } = await supabase
      .from('batch_import_summaries')
      .insert({
        tenant_id: tenantId,
        batch_id: testBatchId,
        total_rows: 3,
        status: 'pending',
      })
      .select()
      .single()

    if (summaryError) {
      throw new Error(`Summary insert failed: ${summaryError.message}`)
    }
    console.log('  Summary created:', summary.id)

    // Step 2: Create jobs
    console.log('\n[2] Creating batch jobs...')
    const jobs = [
      { row_index: 0, payload: { court_case_number: '2024가단12345', court_name: '서울중앙지방법원', client_name: '테스트1' } },
      { row_index: 1, payload: { court_case_number: '2024가단12346', court_name: '서울중앙지방법원', client_name: '테스트2' } },
      { row_index: 2, payload: { court_case_number: '2024가단12347', court_name: '서울중앙지방법원', client_name: '테스트3' } },
    ]

    const { data: insertedJobs, error: jobsError } = await supabase
      .from('batch_import_jobs')
      .insert(jobs.map(j => ({
        tenant_id: tenantId,
        batch_id: testBatchId,
        row_index: j.row_index,
        payload: j.payload,
        status: 'queued',
      })))
      .select()

    if (jobsError) {
      throw new Error(`Jobs insert failed: ${jobsError.message}`)
    }
    console.log(`  ${insertedJobs.length} jobs created`)

    // Step 3: Test dequeue
    console.log('\n[3] Testing dequeue function...')
    const workerId = `test-worker-${Date.now()}`
    const { data: dequeued, error: dequeueError } = await supabase
      .rpc('dequeue_batch_import_jobs', {
        p_limit: 2,
        p_worker_id: workerId,
      })

    if (dequeueError) {
      throw new Error(`Dequeue failed: ${dequeueError.message}`)
    }
    console.log(`  Dequeued ${dequeued?.length || 0} jobs`)

    if (dequeued && dequeued.length > 0) {
      console.log(`  First job status: ${dequeued[0].status}`)
      console.log(`  First job lock_token: ${dequeued[0].lock_token}`)
    }

    // Step 4: Update job statuses
    console.log('\n[4] Updating job statuses...')
    if (dequeued && dequeued.length >= 2) {
      // Mark first job as success
      const { error: successError } = await supabase
        .from('batch_import_jobs')
        .update({
          status: 'success',
          result: { caseId: 'test-case-1', clientId: 'test-client-1' },
          finished_at: new Date().toISOString(),
        })
        .eq('id', dequeued[0].id)

      if (successError) {
        console.error('  Failed to mark success:', successError.message)
      } else {
        console.log('  Job 0 marked as success')
      }

      // Mark second job as failed
      const { error: failError } = await supabase
        .from('batch_import_jobs')
        .update({
          status: 'failed',
          last_error: 'Test error',
          finished_at: new Date().toISOString(),
        })
        .eq('id', dequeued[1].id)

      if (failError) {
        console.error('  Failed to mark failure:', failError.message)
      } else {
        console.log('  Job 1 marked as failed')
      }
    }

    // Dequeue and process remaining job
    const { data: remaining } = await supabase
      .rpc('dequeue_batch_import_jobs', {
        p_limit: 10,
        p_worker_id: workerId,
      })

    if (remaining && remaining.length > 0) {
      for (const job of remaining) {
        await supabase
          .from('batch_import_jobs')
          .update({
            status: 'success',
            result: { caseId: `test-case-${job.row_index}` },
            finished_at: new Date().toISOString(),
          })
          .eq('id', job.id)
      }
      console.log(`  Processed ${remaining.length} more job(s)`)
    }

    // Step 5: Update summary counts
    console.log('\n[5] Updating summary counts...')
    const { error: countError } = await supabase
      .rpc('update_batch_import_summary_counts_manual', {
        p_batch_id: testBatchId,
      })

    if (countError) {
      throw new Error(`Summary counts update failed: ${countError.message}`)
    }
    console.log('  Summary counts updated')

    // Step 6: Verify final state
    console.log('\n[6] Verifying final state...')
    const { data: finalSummary, error: finalError } = await supabase
      .from('batch_import_summaries')
      .select('*')
      .eq('batch_id', testBatchId)
      .single()

    if (finalError) {
      throw new Error(`Final summary fetch failed: ${finalError.message}`)
    }

    console.log('  Final Summary:')
    console.log(`    Status: ${finalSummary.status}`)
    console.log(`    Total: ${finalSummary.total_rows}`)
    console.log(`    Processed: ${finalSummary.processed_rows}`)
    console.log(`    Success: ${finalSummary.success_count}`)
    console.log(`    Failed: ${finalSummary.failed_count}`)
    console.log(`    Skipped: ${finalSummary.skipped_count}`)

    // Validate results
    const allProcessed = finalSummary.processed_rows === finalSummary.total_rows
    const countsMatch = finalSummary.success_count + finalSummary.failed_count + finalSummary.skipped_count === finalSummary.processed_rows
    const statusCorrect = finalSummary.status === 'completed'

    console.log('\n[7] Validation:')
    console.log(`    All jobs processed: ${allProcessed ? 'PASS' : 'FAIL'}`)
    console.log(`    Counts match: ${countsMatch ? 'PASS' : 'FAIL'}`)
    console.log(`    Status is completed: ${statusCorrect ? 'PASS' : 'FAIL'}`)

    // Cleanup
    console.log('\n[8] Cleaning up test data...')
    await supabase.from('batch_import_jobs').delete().eq('batch_id', testBatchId)
    await supabase.from('batch_import_summaries').delete().eq('batch_id', testBatchId)
    console.log('  Test data cleaned up')

    // Final result
    console.log('\n' + '='.repeat(60))
    if (allProcessed && countsMatch && statusCorrect) {
      console.log('E2E TEST PASSED')
    } else {
      console.log('E2E TEST FAILED')
      process.exit(1)
    }
    console.log('='.repeat(60))

  } catch (error) {
    console.error('\nTest failed with error:', error)

    // Cleanup on error
    console.log('\nCleaning up...')
    await supabase.from('batch_import_jobs').delete().eq('batch_id', testBatchId)
    await supabase.from('batch_import_summaries').delete().eq('batch_id', testBatchId)

    process.exit(1)
  }
}

runE2ETest()
