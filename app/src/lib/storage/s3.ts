import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// S3-compatible object storage (MinIO). Configured entirely via env; when
// S3_ENDPOINT is unset the app has no object store and callers should fall
// back to local-disk behavior or surface a clear configuration error.

export function isS3Configured(): boolean {
  return Boolean(
    process.env.S3_ENDPOINT &&
      process.env.S3_BUCKET &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY
  );
}

let cached: S3Client | null = null;

function client(): S3Client {
  if (cached) return cached;
  cached = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || "us-east-1",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "0",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
    },
  });
  return cached;
}

function bucket(): string {
  return process.env.S3_BUCKET as string;
}

let presignCached: S3Client | null = null;

// Browser-facing client used only for presigning GET URLs. Uses
// S3_PUBLIC_ENDPOINT when set (e.g. internal S3_ENDPOINT isn't reachable
// from the browser), falling back to S3_ENDPOINT otherwise.
function presignClient(): S3Client {
  if (presignCached) return presignCached;
  presignCached = new S3Client({
    endpoint: process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || "us-east-1",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "0",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
    },
  });
  return presignCached;
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType?: string
): Promise<void> {
  await client().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function deleteObject(key: string): Promise<void> {
  await client().send(
    new DeleteObjectCommand({ Bucket: bucket(), Key: key })
  );
}

// Short-lived presigned GET URL. The bucket stays private; clients fetch the
// object directly from MinIO using this time-limited URL.
export async function presignGet(
  key: string,
  expiresInSeconds = 300
): Promise<string> {
  return getSignedUrl(
    presignClient(),
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
    { expiresIn: expiresInSeconds }
  );
}
