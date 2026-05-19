import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

export class FileTooLargeError extends Error {
  constructor(maxMB: number) {
    super(`Le fichier dépasse ${maxMB} MB`);
    this.name = "FileTooLargeError";
  }
}

export class InvalidPdfMagicBytesError extends Error {
  constructor() {
    super("Le fichier n'est pas un PDF valide");
    this.name = "InvalidPdfMagicBytesError";
  }
}

export class R2UploadError extends Error {
  constructor(cause: Error) {
    super(`Erreur lors de l'upload vers R2: ${cause.message}`, { cause });
    this.name = "R2UploadError";
  }
}

export class R2DeleteError extends Error {
  constructor(cause: Error) {
    super(`Erreur lors de la suppression sur R2: ${cause.message}`, { cause });
    this.name = "R2DeleteError";
  }
}

export class R2NotFoundError extends Error {
  constructor(key: string) {
    super(`Fichier non trouvé sur R2: ${key}`);
    this.name = "R2NotFoundError";
  }
}

let _r2Client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (_r2Client) return _r2Client;

  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint) throw new Error("R2_ENDPOINT manquant");
  if (!accessKeyId) throw new Error("R2_ACCESS_KEY_ID manquant");
  if (!secretAccessKey) throw new Error("R2_SECRET_ACCESS_KEY manquant");

  _r2Client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return _r2Client;
}

export function __resetR2ClientForTests(): void {
  _r2Client = null;
}

export function buildReportKey(_filename?: string): string {
  const now = new Date();
  const yyyy = now.getFullYear().toString();
  const mm = (now.getMonth() + 1).toString().padStart(2, "0");
  const uuid = crypto.randomUUID();
  return `reports/${yyyy}/${mm}/${uuid}.pdf`;
}

export function isPdfMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  return (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  );
}

export function assertPdfSize(
  buffer: Buffer,
  maxBytes: number = 10 * 1024 * 1024,
): void {
  if (buffer.byteLength > maxBytes) {
    throw new FileTooLargeError(Math.floor(maxBytes / (1024 * 1024)));
  }
}

export async function uploadPdfToR2(
  key: string,
  buffer: Buffer,
): Promise<void> {
  if (!key) throw new Error("key requise");
  if (!buffer.length) throw new Error("buffer requis");

  const client = getR2Client();
  const bucket = process.env.R2_BUCKET;

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: "application/pdf",
      }),
    );
  } catch (err) {
    throw new R2UploadError(err as Error);
  }
}

export async function deletePdfFromR2(key: string): Promise<void> {
  if (!key) throw new Error("key requise");

  const client = getR2Client();
  const bucket = process.env.R2_BUCKET;

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
  } catch (err) {
    throw new R2DeleteError(err as Error);
  }
}

export async function streamPdfFromR2(
  key: string,
): Promise<{ body: ReadableStream; contentLength: number; contentType: string }> {
  if (!key) throw new Error("key requise");

  const client = getR2Client();
  const bucket = process.env.R2_BUCKET;

  try {
    const res = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    return {
      body: res.Body as unknown as ReadableStream,
      contentLength: res.ContentLength ?? 0,
      contentType: res.ContentType ?? "application/pdf",
    };
  } catch (err: unknown) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404) {
      throw new R2NotFoundError(key);
    }
    throw err;
  }
}
