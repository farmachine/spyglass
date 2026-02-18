/**
 * AWS S3 Object Storage Service
 *
 * Drop-in replacement for the Replit/GCS-based objectStorage.ts.
 * Provides the same ObjectStorageService interface using AWS S3.
 *
 * Uses IAM role-based authentication (no hardcoded credentials).
 * In ECS Fargate, credentials come from the task role automatically.
 *
 * ISO 27001 A.8.24: Server-side encryption with KMS
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-west-1',
});

function getBucketName(): string {
  const bucket = process.env.S3_BUCKET_NAME;
  if (!bucket) {
    throw new Error(
      'S3_BUCKET_NAME environment variable is required. ' +
      'Set it to your document storage bucket name (e.g., extrapl-documents-prod).'
    );
  }
  return bucket;
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super('Object not found');
    this.name = 'ObjectNotFoundError';
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  private bucket: string;

  constructor() {
    this.bucket = getBucketName();
  }

  /**
   * Get a presigned upload URL for a new object.
   */
  async getObjectEntityUploadURL(): Promise<string> {
    const objectId = randomUUID();
    const key = `sample-files/${objectId}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ServerSideEncryption: 'aws:kms',
    });

    return getSignedUrl(s3Client, command, { expiresIn: 900 }); // 15 min
  }

  /**
   * Upload a file directly to S3.
   */
  async uploadFile(objectKey: string, buffer: Buffer, contentType: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      Body: buffer,
      ContentType: contentType,
      ServerSideEncryption: 'aws:kms',
    });

    await s3Client.send(command);
  }

  /**
   * Get a presigned download URL for an object.
   */
  async getSignedUrl(objectKey: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
    });

    return getSignedUrl(s3Client, command, { expiresIn: 7 * 24 * 3600 }); // 7 days
  }

  /**
   * Check if an object exists.
   */
  async exists(objectKey: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      });
      await s3Client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Download an object's content as a Buffer.
   */
  async downloadFile(objectKey: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
    });

    const response = await s3Client.send(command);
    if (!response.Body) {
      throw new ObjectNotFoundError();
    }

    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
}

/**
 * Get an S3 client instance for direct operations.
 * Use this when you need bucket-level operations not covered by ObjectStorageService.
 */
export { s3Client as objectStorageClient };

/**
 * Helper to get a file from S3 as a readable stream / buffer.
 * Used by routes that previously accessed GCS bucket directly.
 */
export async function getFileFromStorage(bucketName: string, objectName: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: objectName,
  });

  const response = await s3Client.send(command);
  if (!response.Body) {
    throw new ObjectNotFoundError();
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
