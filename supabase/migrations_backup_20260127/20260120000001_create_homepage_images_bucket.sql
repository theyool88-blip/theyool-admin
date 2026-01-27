-- Create homepage-images storage bucket for homepage content images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'homepage-images',
  'homepage-images',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload homepage images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'homepage-images');

-- Allow authenticated users to update their uploaded images
CREATE POLICY "Authenticated users can update homepage images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'homepage-images');

-- Allow authenticated users to delete images
CREATE POLICY "Authenticated users can delete homepage images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'homepage-images');

-- Allow public read access to homepage images
CREATE POLICY "Public read access for homepage images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'homepage-images');
