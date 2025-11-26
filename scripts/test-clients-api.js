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

async function testClientsAPI() {
  console.log('🔍 Testing Clients Management System...\n')

  try {
    // Test 1: Get all clients
    console.log('1️⃣ GET all clients')
    const { data: clients, error: clientsError, count } = await supabase
      .from('clients')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(10)

    if (clientsError) {
      console.error('   ❌ Error:', clientsError.message)
    } else {
      console.log(`   ✅ Found ${count} total clients`)
      console.log(`   📋 Showing ${clients.length} clients:`)
      clients.forEach((client, idx) => {
        console.log(`      ${idx + 1}. ${client.name} (${client.phone}) - ${client.created_at}`)
      })
    }

    // Test 2: Search by name
    console.log('\n2️⃣ Search clients by name (김)')
    const { data: searchResults, error: searchError } = await supabase
      .from('clients')
      .select('*')
      .ilike('name', '%김%')
      .limit(5)

    if (searchError) {
      console.error('   ❌ Error:', searchError.message)
    } else {
      console.log(`   ✅ Found ${searchResults.length} clients with "김"`)
      searchResults.forEach((client, idx) => {
        console.log(`      ${idx + 1}. ${client.name} (${client.phone})`)
      })
    }

    // Test 3: Get client by ID (if any exist)
    if (clients && clients.length > 0) {
      const firstClient = clients[0]
      console.log(`\n3️⃣ GET client by ID: ${firstClient.id}`)
      const { data: singleClient, error: singleError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', firstClient.id)
        .single()

      if (singleError) {
        console.error('   ❌ Error:', singleError.message)
      } else {
        console.log('   ✅ Client details:')
        console.log(`      Name: ${singleClient.name}`)
        console.log(`      Phone: ${singleClient.phone}`)
        console.log(`      Email: ${singleClient.email || 'N/A'}`)
        console.log(`      Gender: ${singleClient.gender || 'N/A'}`)
        console.log(`      Birth Date: ${singleClient.birth_date || 'N/A'}`)
      }
    }

    // Test 4: Check database schema
    console.log('\n4️⃣ Database schema info')
    const { data: schemaData, error: schemaError } = await supabase
      .from('clients')
      .select('*')
      .limit(1)

    if (!schemaError && schemaData && schemaData.length > 0) {
      console.log('   ✅ Columns in clients table:')
      Object.keys(schemaData[0]).forEach(col => {
        console.log(`      - ${col}`)
      })
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
  }
}

testClientsAPI()
