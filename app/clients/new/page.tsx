import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import NewClientForm from '@/components/NewClientForm'

export default async function NewClientPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('tenant_members')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!profile) {
    redirect('/login')
  }

  return <NewClientForm />
}
