import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { slugify } from "./index";

const DEFAULT_SUPABASE_URL = "https://xiklunkmdpqzlhmrfkql.supabase.co";
const DEFAULT_SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhpa2x1bmttZHBxemxobXJma3FsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTEyNDQ3NywiZXhwIjoyMTA2NzAwNDc3fQ.JfPA42wthygKWPs7KaAR1BJDnMH4t1wydQ_zTSKZjRM";
const DEFAULT_CLOUDFLARE_ACCOUNT_ID = "e96fb9441d9085bf6ebe215d152ec37d";
const DEFAULT_R2_ACCESS_KEY_ID = "16fd1412b0cb0d4b071c4544ff0880e4";
const DEFAULT_R2_SECRET_ACCESS_KEY = "da39b83a69bcd9080f03c4000bbb2f3011dc2816952c479d05a9b9866258ee53";
const DEFAULT_R2_BUCKET_NAME = "marketos-media";

/**
 * Cloudflare R2 Client (S3 Compatible)
 */
export function getR2Client(): S3Client {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || DEFAULT_CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || DEFAULT_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || DEFAULT_R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "[Cloudflare R2] Missing CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY"
    );
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export type StorageFolder = "products" | "proofs" | "branding" | "documents";

export interface UploadFileInput {
  tenantId: string;
  folder: StorageFolder;
  fileName: string;
  body: Buffer | Uint8Array | Blob | string;
  contentType: string;
  bucket?: string;
}

export interface UploadResult {
  key: string;
  url: string;
  bucket: string;
}

/**
 * Generates an isolated multi-tenant object key
 * e.g.: shop-market-ca/products/1712345678-harina-pan.jpg
 */
export function buildTenantStorageKey(
  tenantId: string,
  folder: StorageFolder,
  fileName: string
): string {
  const extension = fileName.includes(".")
    ? fileName.substring(fileName.lastIndexOf("."))
    : "";
  const baseName = fileName.replace(extension, "");
  const cleanName = slugify(baseName);
  const timestamp = Date.now();
  return `${tenantId}/${folder}/${timestamp}-${cleanName}${extension}`;
}

/**
 * Upload a file directly to Cloudflare R2 or Supabase Storage (High Availability)
 */
export async function uploadToR2(input: UploadFileInput): Promise<UploadResult> {
  const key = buildTenantStorageKey(input.tenantId, input.folder, input.fileName);

  // 1. Prioritize Supabase Storage public CDN
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SUPABASE_SERVICE_ROLE_KEY;
    const bucket = "marketos-media";

    const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${key}`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": input.contentType,
        "x-upsert": "true",
      },
      body: input.body as any,
    });

    if (uploadRes.ok) {
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${key}`;
      return {
        key,
        url: publicUrl,
        bucket,
      };
    }
  } catch (err) {
    console.warn("[MarketOS Storage] Supabase Storage upload note, falling back to R2:", err);
  }

  // 2. Cloudflare R2 Fallback
  const client = getR2Client();
  const bucket = input.bucket || process.env.R2_BUCKET_NAME || DEFAULT_R2_BUCKET_NAME;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: input.body,
    ContentType: input.contentType,
    Metadata: {
      "tenant-id": input.tenantId,
      "uploaded-at": new Date().toISOString(),
    },
  });

  await client.send(command);

  const publicUrl = getR2FileUrl(key, bucket);

  return {
    key,
    url: publicUrl,
    bucket,
  };
}

/**
 * Generate a pre-signed upload URL for direct client-to-R2 uploads
 * (Prevents large file uploads from passing through Next.js server)
 */
export async function createPresignedUploadUrl(
  tenantId: string,
  folder: StorageFolder,
  fileName: string,
  contentType: string,
  expiresIn = 300 // 5 minutes
): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME || "shopmarket";
  const key = buildTenantStorageKey(tenantId, folder, fileName);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    Metadata: {
      "tenant-id": tenantId,
    },
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn });
  const publicUrl = getR2FileUrl(key, bucket);

  return {
    uploadUrl,
    key,
    publicUrl,
  };
}

/**
 * Resolve Public URL for an R2 object key
 */
export function getR2FileUrl(key: string, bucket = process.env.R2_BUCKET_NAME || DEFAULT_R2_BUCKET_NAME): string {
  const publicDomain = process.env.R2_PUBLIC_DOMAIN;
  if (publicDomain) {
    const cleanDomain = publicDomain.endsWith("/")
      ? publicDomain.slice(0, -1)
      : publicDomain;
    return `${cleanDomain}/${key}`;
  }

  // Fallback to S3 endpoint format or dev URL
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || DEFAULT_CLOUDFLARE_ACCOUNT_ID;
  return `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`;
}

/**
 * Delete a file from Cloudflare R2
 */
export async function deleteFromR2(key: string, bucket = process.env.R2_BUCKET_NAME || "shopmarket"): Promise<void> {
  const client = getR2Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}

/**
 * List files for a specific tenant in R2
 */
export async function listTenantFiles(tenantId: string, folder?: StorageFolder) {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME || "shopmarket";
  const prefix = folder ? `${tenantId}/${folder}/` : `${tenantId}/`;

  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
  });

  const response = await client.send(command);
  return response.Contents || [];
}
