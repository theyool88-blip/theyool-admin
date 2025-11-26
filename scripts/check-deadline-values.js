const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://kqqyipnlkmmprfgygauk.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkValues() {
  // Get all deadlines to see what status values exist
  const { data, error } = await supabase
    .from('case_deadlines')
    .select('*')

  if (error) {
    console.error('Error:', error)
  } else {
    console.log('Total deadlines:', data.length)
    const statuses = [...new Set(data.map(d => d.status))]
    console.log('Unique status values:', statuses)

    console.log('\nSample deadline:')
    console.log(JSON.stringify(data[0], null, 2))
  }
}

checkValues()
