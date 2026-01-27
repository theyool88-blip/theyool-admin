/**
 * Set up RLS policies for homepage-images storage bucket
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function setupPolicies() {
  console.log('Setting up storage policies...');

  // Use raw SQL to create policies
  const policies = [
    {
      name: 'Allow authenticated uploads to homepage-images',
      sql: `
        CREATE POLICY "Allow authenticated uploads to homepage-images"
        ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK (bucket_id = 'homepage-images');
      `,
    },
    {
      name: 'Allow authenticated updates to homepage-images',
      sql: `
        CREATE POLICY "Allow authenticated updates to homepage-images"
        ON storage.objects FOR UPDATE
        TO authenticated
        USING (bucket_id = 'homepage-images');
      `,
    },
    {
      name: 'Allow authenticated deletes from homepage-images',
      sql: `
        CREATE POLICY "Allow authenticated deletes from homepage-images"
        ON storage.objects FOR DELETE
        TO authenticated
        USING (bucket_id = 'homepage-images');
      `,
    },
    {
      name: 'Allow public read access to homepage-images',
      sql: `
        CREATE POLICY "Allow public read access to homepage-images"
        ON storage.objects FOR SELECT
        TO public
        USING (bucket_id = 'homepage-images');
      `,
    },
  ];

  for (const policy of policies) {
    console.log(`Creating policy: ${policy.name}`);
    const { error } = await supabase.rpc('exec_sql', { sql: policy.sql });

    if (error) {
      // Policy might already exist, try to continue
      if (error.message?.includes('already exists')) {
        console.log(`  Policy already exists, skipping...`);
      } else {
        console.log(`  Note: ${error.message}`);
      }
    } else {
      console.log(`  Created successfully`);
    }
  }

  console.log('\nDone! Testing upload...');

  // Test upload
  const testData = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG header
  const { data, error } = await supabase.storage
    .from('homepage-images')
    .upload('test/test-file.png', testData, {
      contentType: 'image/png',
      upsert: true,
    });

  if (error) {
    console.error('Test upload failed:', error);
  } else {
    console.log('Test upload successful:', data);

    // Clean up test file
    await supabase.storage.from('homepage-images').remove(['test/test-file.png']);
    console.log('Test file cleaned up');
  }
}

setupPolicies();
