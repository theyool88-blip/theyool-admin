require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testConsultationSources() {
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║   상담 유입 경로 시스템 테스트                            ║')
  console.log('╚═══════════════════════════════════════════════════════════╝\n')

  try {
    // 1. Check if table exists
    console.log('1️⃣ Checking consultation_sources table...')
    const { data: sources, error: sourcesError } = await supabase
      .from('consultation_sources')
      .select('*')
      .order('display_order')

    if (sourcesError) {
      console.error('❌ Error:', sourcesError.message)
      console.log('\n💡 Tip: 마이그레이션이 적용되지 않았을 수 있습니다.')
      console.log('   다음 파일을 Supabase Dashboard에서 실행해주세요:')
      console.log('   supabase/migrations/20251125_add_consultation_sources.sql')
      return
    }

    if (!sources || sources.length === 0) {
      console.log('⚠️  No sources found. Migration may not be applied.')
      return
    }

    console.log(`✅ Found ${sources.length} consultation sources:\n`)

    // Display sources
    sources.forEach((s, idx) => {
      console.log(`${idx + 1}. ${s.name}`)
      console.log(`   ID: ${s.id}`)
      console.log(`   Color: ${s.color}`)
      console.log(`   Display Order: ${s.display_order}`)
      console.log(`   Active: ${s.is_active ? '✅' : '❌'}`)
      console.log(`   Default: ${s.is_default ? '✅' : '❌'}`)
      console.log(`   Usage Count: ${s.usage_count}건`)
      if (s.description) {
        console.log(`   Description: ${s.description}`)
      }
      console.log('')
    })

    // 2. Check default source
    console.log('2️⃣ Checking default source...')
    const defaultSource = sources.find(s => s.is_default && s.is_active)
    if (defaultSource) {
      console.log(`✅ Default source: "${defaultSource.name}"`)
    } else {
      console.log('⚠️  No default source set')
    }
    console.log('')

    // 3. Check consultations.source column
    console.log('3️⃣ Checking consultations table...')
    const { data: sampleConsultations, error: consultationsError } = await supabase
      .from('consultations')
      .select('id, name, source, created_at')
      .order('created_at', { ascending: false })
      .limit(5)

    if (consultationsError) {
      console.error('❌ Error:', consultationsError.message)
      return
    }

    console.log(`✅ Found ${sampleConsultations?.length || 0} recent consultations`)
    if (sampleConsultations && sampleConsultations.length > 0) {
      console.log('\nSample consultations:')
      sampleConsultations.forEach((c, idx) => {
        console.log(`   ${idx + 1}. ${c.name} - Source: ${c.source || '(없음)'}`)
      })
    }
    console.log('')

    // 4. Statistics
    console.log('4️⃣ Calculating statistics...')
    const { data: allConsultations } = await supabase
      .from('consultations')
      .select('source')

    const sourceCounts = new Map()
    let totalWithSource = 0
    let totalWithoutSource = 0

    allConsultations?.forEach(c => {
      if (c.source) {
        sourceCounts.set(c.source, (sourceCounts.get(c.source) || 0) + 1)
        totalWithSource++
      } else {
        totalWithoutSource++
      }
    })

    console.log(`✅ Total consultations: ${allConsultations?.length || 0}`)
    console.log(`   With source: ${totalWithSource}`)
    console.log(`   Without source: ${totalWithoutSource}`)
    console.log('')

    if (sourceCounts.size > 0) {
      console.log('📊 Source distribution:')
      const sortedSources = Array.from(sourceCounts.entries())
        .sort((a, b) => b[1] - a[1])

      sortedSources.forEach(([name, count]) => {
        const percentage = ((count / totalWithSource) * 100).toFixed(1)
        const sourceInfo = sources.find(s => s.name === name)
        const color = sourceInfo?.color || 'gray'
        console.log(`   ${name}: ${count}건 (${percentage}%) [${color}]`)
      })
      console.log('')
    }

    // 5. Verify usage_count accuracy
    console.log('5️⃣ Verifying usage_count accuracy...')
    let accuracyMatch = true
    sources.forEach(source => {
      const actualCount = sourceCounts.get(source.name) || 0
      if (actualCount !== source.usage_count) {
        console.log(`⚠️  Mismatch for "${source.name}": cached=${source.usage_count}, actual=${actualCount}`)
        accuracyMatch = false
      }
    })

    if (accuracyMatch) {
      console.log('✅ All usage_count values are accurate!')
    } else {
      console.log('⚠️  Some usage_count values are inaccurate. This may happen if:')
      console.log('   - Migration was applied after consultations were created')
      console.log('   - Trigger is not working properly')
      console.log('\n   You can recalculate usage_count by running this SQL:')
      console.log('   UPDATE consultation_sources cs')
      console.log('   SET usage_count = (')
      console.log('     SELECT COUNT(*) FROM consultations c WHERE c.source = cs.name')
      console.log('   );')
    }
    console.log('')

    // Summary
    console.log('═'.repeat(63))
    console.log('✅ 테스트 완료!')
    console.log('═'.repeat(63))
    console.log('')
    console.log('다음 단계:')
    console.log('  1. 상담 등록/수정 폼에 유입 경로 선택 추가')
    console.log('  2. 대시보드에 유입 경로 통계 표시')
    console.log('  3. 유입 경로 관리 UI 페이지 생성 (/admin/settings/sources)')
    console.log('')

  } catch (error) {
    console.error('❌ Test failed:', error.message)
    if (error.stack) {
      console.error(error.stack)
    }
  }
}

testConsultationSources()
