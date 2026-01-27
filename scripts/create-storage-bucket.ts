/**
 * Create homepage-images storage bucket in Supabase
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

async function createBucket() {
  console.log('Creating homepage-images bucket...');

  // Check if bucket exists
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    console.error('Error listing buckets:', listError);
    process.exit(1);
  }

  const existingBucket = buckets?.find((b) => b.id === 'homepage-images');

  if (existingBucket) {
    console.log('Bucket already exists:', existingBucket);
    return;
  }

  // Create the bucket
  const { data, error } = await supabase.storage.createBucket('homepage-images', {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  });

  if (error) {
    console.error('Error creating bucket:', error);
    process.exit(1);
  }

  console.log('Bucket created successfully:', data);
}

createBucket();
