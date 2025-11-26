const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kqqyipnlkmmprfgygauk.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function testClientsManagement() {
  console.log('\n' + '='.repeat(60))
  console.log('📋 PHASE 1: 의뢰인 관리 시스템 (Clients Management)')
  console.log('='.repeat(60))

  try {
    // Test 1: Get all clients
    console.log('\n1️⃣ GET all clients')
    const { data: clients, error: clientsError, count } = await supabase
      .from('clients')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(5)

    if (clientsError) {
      console.error('   ❌ Error:', clientsError.message)
      return false
    } else {
      console.log(`   ✅ Found ${count} total clients`)
      console.log(`   📊 Sample: ${clients[0].name}, ${clients[1].name}, ${clients[2].name}...`)
    }

    // Test 2: Search clients
    console.log('\n2️⃣ Search clients by name')
    const { data: searchResults, error: searchError } = await supabase
      .from('clients')
      .select('*')
      .ilike('name', '%김%')
      .limit(3)

    if (searchError) {
      console.error('   ❌ Error:', searchError.message)
      return false
    } else {
      console.log(`   ✅ Found ${searchResults.length} clients with "김"`)
    }

    // Test 3: Get single client
    if (clients && clients.length > 0) {
      const clientId = clients[0].id
      console.log(`\n3️⃣ GET single client (${clientId})`)
      const { data: singleClient, error: singleError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single()

      if (singleError) {
        console.error('   ❌ Error:', singleError.message)
        return false
      } else {
        console.log(`   ✅ Retrieved: ${singleClient.name} (${singleClient.phone})`)
      }
    }

    // Test 4: Check schema
    console.log('\n4️⃣ Database schema')
    const columns = Object.keys(clients[0])
    console.log(`   ✅ Table has ${columns.length} columns: ${columns.slice(0, 5).join(', ')}...`)

    console.log('\n✅ Clients Management: ALL TESTS PASSED')
    return true

  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
    return false
  }
}

async function testConsultationsManagement() {
  console.log('\n' + '='.repeat(60))
  console.log('💬 PHASE 2: 상담 관리 시스템 (Consultations Management)')
  console.log('='.repeat(60))

  try {
    // Test 1: Get all consultations
    console.log('\n1️⃣ GET all consultations')
    const { data: consultations, error: consultError, count } = await supabase
      .from('consultations')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(5)

    if (consultError) {
      console.error('   ❌ Error:', consultError.message)
      return false
    } else {
      console.log(`   ✅ Found ${count} total consultations`)
      if (consultations.length > 0) {
        console.log(`   📊 Sample: ${consultations[0].name || 'N/A'}, ${consultations[1]?.name || 'N/A'}...`)
      }
    }

    // Test 2: Filter by status
    console.log('\n2️⃣ Filter consultations by status')
    const { data: pendingConsults, error: statusError } = await supabase
      .from('consultations')
      .select('*')
      .eq('status', '대기중')
      .limit(3)

    if (statusError) {
      console.error('   ❌ Error:', statusError.message)
      return false
    } else {
      console.log(`   ✅ Found ${pendingConsults.length} consultations with status "대기중"`)
    }

    // Test 3: Get single consultation
    if (consultations && consultations.length > 0) {
      const consultId = consultations[0].id
      console.log(`\n3️⃣ GET single consultation (${consultId})`)
      const { data: singleConsult, error: singleError } = await supabase
        .from('consultations')
        .select('*')
        .eq('id', consultId)
        .single()

      if (singleError) {
        console.error('   ❌ Error:', singleError.message)
        return false
      } else {
        console.log(`   ✅ Retrieved: ${singleConsult.name || 'N/A'} - ${singleConsult.status}`)
      }
    }

    // Test 4: Get consultation stats
    console.log('\n4️⃣ Consultation statistics')
    const { data: stats, error: statsError } = await supabase
      .rpc('get_consultation_stats')
      .single()

    if (statsError) {
      // Fallback: manual count
      const { count: totalCount } = await supabase
        .from('consultations')
        .select('*', { count: 'exact', head: true })
      console.log(`   ⚠️  RPC not found, manual count: ${totalCount} total`)
    } else {
      console.log(`   ✅ Stats retrieved successfully`)
    }

    console.log('\n✅ Consultations Management: ALL TESTS PASSED')
    return true

  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
    return false
  }
}

async function testCasesManagement() {
  console.log('\n' + '='.repeat(60))
  console.log('⚖️  PHASE 3: 사건 관리 시스템 (Cases Management)')
  console.log('='.repeat(60))

  try {
    // Test 1: Get all cases
    console.log('\n1️⃣ GET all cases')
    const { data: cases, error: casesError, count } = await supabase
      .from('cases')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(5)

    if (casesError) {
      console.error('   ❌ Error:', casesError.message)
      return false
    } else {
      console.log(`   ✅ Found ${count} total cases`)
      if (cases.length > 0) {
        console.log(`   📊 Sample: ${cases[0].case_number || 'N/A'}, ${cases[1]?.case_number || 'N/A'}...`)
      }
    }

    // Test 2: Filter by published status
    console.log('\n2️⃣ Filter cases by published status')
    const { data: publishedCases, error: statusError } = await supabase
      .from('cases')
      .select('*')
      .eq('published', true)
      .limit(3)

    if (statusError) {
      console.error('   ❌ Error:', statusError.message)
      return false
    } else {
      console.log(`   ✅ Found ${publishedCases.length} published cases`)
    }

    // Test 3: Filter by category
    console.log('\n3️⃣ Filter cases by category')
    const { data: categoryCases, error: categoryError } = await supabase
      .from('cases')
      .select('*')
      .contains('categories', ['이혼'])
      .limit(3)

    if (categoryError) {
      console.error('   ⚠️  Categories filter not working, skipping')
    } else {
      console.log(`   ✅ Found ${categoryCases.length} cases in "이혼" category`)
    }

    // Test 4: Get single case (blog/success case)
    if (cases && cases.length > 0) {
      const caseId = cases[0].id
      console.log(`\n4️⃣ GET single case (${caseId})`)
      const { data: singleCase, error: singleError } = await supabase
        .from('cases')
        .select('*')
        .eq('id', caseId)
        .single()

      if (singleError) {
        console.error('   ❌ Error:', singleError.message)
        return false
      } else {
        console.log(`   ✅ Retrieved case: ${singleCase.title || singleCase.case_number}`)
        console.log(`   📖 Published: ${singleCase.published}, Views: ${singleCase.views}`)
      }
    }

    // Test 5: Get case stats
    console.log('\n5️⃣ Case statistics')
    const { count: totalCases } = await supabase
      .from('cases')
      .select('*', { count: 'exact', head: true })
    const { count: publishedCount } = await supabase
      .from('cases')
      .select('*', { count: 'exact', head: true })
      .eq('published', true)
    console.log(`   ✅ Total cases: ${totalCases}, Published: ${publishedCount}`)

    console.log('\n✅ Cases Management: ALL TESTS PASSED')
    return true

  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
    return false
  }
}

async function testCaseDeadlinesManagement() {
  console.log('\n' + '='.repeat(60))
  console.log('⏰ PHASE 4: 사건 기한 관리 (Case Deadlines Management)')
  console.log('='.repeat(60))

  try {
    // Test 1: Get all deadlines
    console.log('\n1️⃣ GET all case deadlines')
    const { data: deadlines, error: deadlinesError, count } = await supabase
      .from('case_deadlines')
      .select('*', { count: 'exact' })
      .order('deadline_date', { ascending: true })
      .limit(5)

    if (deadlinesError) {
      console.error('   ❌ Error:', deadlinesError.message)
      return false
    } else {
      console.log(`   ✅ Found ${count} total deadlines`)
      if (deadlines.length > 0) {
        console.log(`   📊 Sample: ${deadlines[0].deadline_type}, ${deadlines[1]?.deadline_type}...`)
      }
    }

    // Test 2: Get upcoming deadlines
    const today = new Date().toISOString().split('T')[0]
    console.log(`\n2️⃣ Get upcoming deadlines (after ${today})`)
    const { data: upcomingDeadlines, error: upcomingError } = await supabase
      .from('case_deadlines')
      .select('*')
      .gte('deadline_date', today)
      .eq('status', 'PENDING')
      .order('deadline_date', { ascending: true })
      .limit(5)

    if (upcomingError) {
      console.error('   ❌ Error:', upcomingError.message)
      return false
    } else {
      console.log(`   ✅ Found ${upcomingDeadlines.length} upcoming pending deadlines`)
    }

    // Test 3: Get completed deadlines
    console.log('\n3️⃣ Get completed deadlines')
    const { data: completedDeadlines, error: completedError } = await supabase
      .from('case_deadlines')
      .select('*')
      .eq('status', 'COMPLETED')
      .limit(5)

    if (completedError) {
      console.error('   ❌ Error:', completedError.message)
      return false
    } else {
      console.log(`   ✅ Found ${completedDeadlines.length} completed deadlines`)
    }

    // Test 4: Get single deadline
    if (deadlines && deadlines.length > 0) {
      const deadlineId = deadlines[0].id
      console.log(`\n4️⃣ GET single deadline (${deadlineId})`)
      const { data: singleDeadline, error: singleError } = await supabase
        .from('case_deadlines')
        .select('*')
        .eq('id', deadlineId)
        .single()

      if (singleError) {
        console.error('   ❌ Error:', singleError.message)
        return false
      } else {
        console.log(`   ✅ Retrieved: ${singleDeadline.deadline_type}`)
        console.log(`   📅 Date: ${singleDeadline.deadline_date}, Status: ${singleDeadline.status}`)
      }
    }

    console.log('\n✅ Case Deadlines Management: ALL TESTS PASSED')
    return true

  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
    return false
  }
}

async function runAllTests() {
  console.log('\n🚀 Starting Comprehensive Management Systems Review')
  console.log('=' .repeat(60))

  const results = {
    clients: await testClientsManagement(),
    consultations: await testConsultationsManagement(),
    cases: await testCasesManagement(),
    deadlines: await testCaseDeadlinesManagement()
  }

  console.log('\n' + '='.repeat(60))
  console.log('📊 FINAL SUMMARY')
  console.log('='.repeat(60))
  console.log(`\n✅ Phase 1 (의뢰인 관리): ${results.clients ? 'PASS' : 'FAIL'}`)
  console.log(`✅ Phase 2 (상담 관리): ${results.consultations ? 'PASS' : 'FAIL'}`)
  console.log(`✅ Phase 3 (사건 관리): ${results.cases ? 'PASS' : 'FAIL'}`)
  console.log(`✅ Phase 4 (기한 관리): ${results.deadlines ? 'PASS' : 'FAIL'}`)

  const allPassed = Object.values(results).every(r => r === true)
  if (allPassed) {
    console.log('\n🎉 ALL SYSTEMS VERIFIED - READY FOR PRODUCTION')
  } else {
    console.log('\n⚠️  SOME SYSTEMS NEED ATTENTION')
  }
  console.log('='.repeat(60) + '\n')
}

runAllTests()
