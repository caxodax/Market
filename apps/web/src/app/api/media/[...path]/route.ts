import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client } from "@marketos/utils";

export const dynamic = "force-dynamic";

const bucketName = process.env.R2_BUCKET_NAME || "marketos-media";

function getContentType(key: string, reportedType?: string): string {
  if (reportedType && reportedType !== "application/octet-stream") {
    return reportedType;
  }
  const lower = key.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  const pathSegments = resolvedParams.path;

  if (!pathSegments || pathSegments.length === 0) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const key = pathSegments.join("/");

  // 1. Primary Source: Cloudflare R2
  try {
    const s3 = getR2Client();
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const response = await s3.send(command);

    if (response.Body) {
      const contentType = getContentType(key, response.ContentType);
      const stream = response.Body.transformToWebStream();

      return new NextResponse(stream, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
          ...(response.ETag ? { ETag: response.ETag } : {}),
        },
      });
    }
  } catch (r2Err) {
    console.warn(`[R2 Media Proxy] Could not stream ${key} from R2:`, r2Err);
  }

  // 2. Resilient Backup: Supabase Storage
  try {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      "https://xiklunkmdpqzlhmrfkql.supabase.co";
    const supabaseFallback = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${key}`;
    const fallbackRes = await fetch(supabaseFallback);

    if (fallbackRes.ok && fallbackRes.body) {
      const contentType =
        fallbackRes.headers.get("content-type") || getContentType(key);
      return new NextResponse(fallbackRes.body, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
  } catch (fallbackErr) {
    console.error(`[Media Proxy Backup] Failed for ${key}:`, fallbackErr);
  }

  return new NextResponse("Media asset not found", { status: 404 });
}
