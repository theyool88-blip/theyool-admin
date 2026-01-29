/**
 * Cloudflare R2 Client using AWS S3 SDK
 *
 * Provides core R2 operations including:
 * - Presigned URL generation for uploads/downloads
 * - Object deletion and listing
 * - Object metadata retrieval
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  type HeadObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Environment variable validation
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_UPLOAD_URL_EXPIRY = parseInt(process.env.R2_UPLOAD_URL_EXPIRY || '3600', 10);
const R2_DOWNLOAD_URL_EXPIRY = parseInt(process.env.R2_DOWNLOAD_URL_EXPIRY || '300', 10);

// Singleton S3 client instance
let s3Client: S3Client | null = null;

/**
 * Get or create the singleton S3Client instance configured for Cloudflare R2
 */
export function getR2Client(): S3Client {
  if (s3Client) {
    return s3Client;
  }

  // Validate required environment variables
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    throw new Error(
      'Missing required R2 environment variables: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME'
    );
  }

  // Create S3 client configured for Cloudflare R2
  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  return s3Client;
}

/**
 * Generate a presigned URL for uploading an object to R2
 *
 * @param key - Object key (path) in the bucket
 * @param contentType - MIME type of the file
 * @param expiresIn - URL expiration time in seconds (default: R2_UPLOAD_URL_EXPIRY)
 * @returns Presigned upload URL
 */
export async function generateUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = R2_UPLOAD_URL_EXPIRY
): Promise<string> {
  const client = getR2Client();

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  try {
    const url = await getSignedUrl(client, command, { expiresIn });
    return url;
  } catch (error) {
    throw new Error(
      `Failed to generate upload URL for key "${key}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Generate a presigned URL for downloading an object from R2
 *
 * @param key - Object key (path) in the bucket
 * @param expiresIn - URL expiration time in seconds (default: R2_DOWNLOAD_URL_EXPIRY)
 * @returns Presigned download URL
 */
export async function generateDownloadUrl(
  key: string,
  expiresIn: number = R2_DOWNLOAD_URL_EXPIRY
): Promise<string> {
  const client = getR2Client();

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  try {
    const url = await getSignedUrl(client, command, { expiresIn });
    return url;
  } catch (error) {
    throw new Error(
      `Failed to generate download URL for key "${key}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Delete an object from R2
 *
 * @param key - Object key (path) to delete
 */
export async function deleteObject(key: string): Promise<void> {
  const client = getR2Client();

  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  try {
    await client.send(command);
  } catch (error) {
    throw new Error(
      `Failed to delete object with key "${key}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * List objects in R2 with a given prefix
 *
 * @param prefix - Key prefix to filter objects
 * @returns Array of objects with key, size, and lastModified
 */
export async function listObjects(
  prefix: string
): Promise<{ key: string; size: number; lastModified: Date }[]> {
  const client = getR2Client();

  const command = new ListObjectsV2Command({
    Bucket: R2_BUCKET_NAME,
    Prefix: prefix,
  });

  try {
    const response = await client.send(command);

    if (!response.Contents || response.Contents.length === 0) {
      return [];
    }

    return response.Contents.map((obj) => ({
      key: obj.Key || '',
      size: obj.Size || 0,
      lastModified: obj.LastModified || new Date(),
    }));
  } catch (error) {
    throw new Error(
      `Failed to list objects with prefix "${prefix}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Get object metadata from R2
 *
 * @param key - Object key (path) to retrieve metadata for
 * @returns Object metadata or null if not found
 */
export async function headObject(
  key: string
): Promise<{ size: number; contentType: string; etag: string } | null> {
  const client = getR2Client();

  const command = new HeadObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  try {
    const response: HeadObjectCommandOutput = await client.send(command);

    return {
      size: response.ContentLength || 0,
      contentType: response.ContentType || 'application/octet-stream',
      etag: response.ETag || '',
    };
  } catch (error: unknown) {
    // Return null if object not found (404)
    if (
      error &&
      typeof error === 'object' &&
      ('name' in error && error.name === 'NotFound' ||
       '$metadata' in error &&
       typeof error.$metadata === 'object' &&
       error.$metadata !== null &&
       'httpStatusCode' in error.$metadata &&
       error.$metadata.httpStatusCode === 404)
    ) {
      return null;
    }

    throw new Error(
      `Failed to get object metadata for key "${key}": ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
