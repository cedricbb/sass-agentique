import { cookies } from "next/headers";
import { requireAdmin } from "@/lib/auth";
import {
  isPdfMagicBytes,
  assertPdfSize,
  buildReportKey,
  uploadPdfToR2,
  deletePdfFromR2,
  FileTooLargeError,
} from "@/lib/storage/r2";

async function uploadAction(formData: FormData) {
  "use server";
  await requireAdmin();

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return;

  const buffer = Buffer.from(await file.arrayBuffer());

  if (!isPdfMagicBytes(buffer)) return;

  try {
    assertPdfSize(buffer);
  } catch (e) {
    if (e instanceof FileTooLargeError) return;
    throw e;
  }

  const key = buildReportKey(file.name);
  await uploadPdfToR2(key, buffer);

  const jar = await cookies();
  jar.set("spike-upload-key", key, { httpOnly: true, path: "/" });
}

async function deleteAction() {
  "use server";
  await requireAdmin();

  const jar = await cookies();
  const key = jar.get("spike-upload-key")?.value;
  if (!key) return;

  await deletePdfFromR2(key);
  jar.delete("spike-upload-key");
}

export default async function SpikeUploadPage() {
  await requireAdmin();

  const jar = await cookies();
  const uploadedKey = jar.get("spike-upload-key")?.value;

  return (
    <div style={{ padding: "2rem", maxWidth: 600 }}>
      <h1>Spike Upload R2</h1>

      <form action={uploadAction}>
        <input type="file" name="file" accept="application/pdf" />
        <button type="submit">Upload PDF</button>
      </form>

      {uploadedKey && (
        <section style={{ marginTop: "2rem" }}>
          <h2>Spike actions</h2>
          <p>
            <a
              href={`/admin/_spike-upload/file?key=${encodeURIComponent(uploadedKey)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Voir le PDF
            </a>
          </p>
          <form action={deleteAction}>
            <button type="submit">Supprimer</button>
          </form>
        </section>
      )}
    </div>
  );
}
