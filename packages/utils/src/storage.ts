import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { slugify } from "./index";

/**
 * Cloudflare R2 Client (S3 Compatible)
 */
export function getR2Client(): S3Client {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

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
 * Upload a file directly to Cloudflare R2
 */
export async function uploadToR2(input: UploadFileInput): Promise<UploadResult> {
  const client = getR2Client();
  const bucket = input.bucket || process.env.R2_BUCKET_NAME || "shopmarket";
  const key = buildTenantStorageKey(input.tenantId, input.folder, input.fileName);

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
export function getR2FileUrl(key: string, bucket = process.env.R2_BUCKET_NAME || "shopmarket"): string {
  const publicDomain = process.env.R2_PUBLIC_DOMAIN;
  if (publicDomain) {
    const cleanDomain = publicDomain.endsWith("/")
      ? publicDomain.slice(0, -1)
      : publicDomain;
    return `${cleanDomain}/${key}`;
  }

  // Fallback to S3 endpoint format or dev URL
  return `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucket}/${key}`;
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
