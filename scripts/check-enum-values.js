const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkEnumValues() {
  // Check actual hearing_type values in database
  const { data, error } = await supabase
    .from('court_hearings')
    .select('hearing_type')
    .limit(10)

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log('Actual hearing_type values:')
  const uniqueTypes = [...new Set(data.map(d => d.hearing_type))]
  console.log(uniqueTypes)
}

checkEnumValues()
