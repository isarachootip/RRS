"use client";

import { useEffect, useState } from "react";
import { API_URL, api, type UploadedFileRecord, uploadEntityFile } from "@/lib/api";

interface IdentityDocSectionProps {
  entityType: "owner_id_doc" | "lead_id_doc";
  entityId?: string | null;
  identityNo: string;
  onIdentityNoChange: (val: string) => void;
  pendingFile?: File | null;
  onPendingFileChange?: (file: File | null) => void;
}

export function IdentityDocSection(props: IdentityDocSectionProps) {
  const { entityType, entityId, identityNo, onIdentityNoChange, pendingFile, onPendingFileChange } = props;
  const [files, setFiles] = useState<UploadedFileRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!entityId) {
      setFiles([]);
      return;
    }
    void api<{ items?: UploadedFileRecord[] }>(`/api/v1/files?entityType=${entityType}&entityId=${entityId}`)
      .then((res) => setFiles(res?.items ?? []))
      .catch(() => {});
  }, [entityType, entityId]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setError(null);
    if (!entityId) {
      onPendingFileChange?.(file);
      return;
    }
    setUploading(true);
    try {
      const uploaded = await uploadEntityFile(file, entityType, entityId);
      setFiles((prev) => [uploaded, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "อัปโหลดไฟล์สแกนไม่สำเร็จ");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleRemove(fileId: string) {
    try {
      await api(`/api/v1/files/${fileId}/archive`, { method: "POST" });
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch {
      setError("ลบไฟล์สแกนไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-line bg-surface-subtle/60 p-3 sm:col-span-2">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-medium text-ink">
          <span>เลขบัตรประชาชน (ID Card) / Passport No.</span>
          <input
            type="text"
            aria-label="เลขบัตรประชาชนหรือพาสปอร์ต"
            placeholder="เช่น 1-1001-00001-01-1 หรือ AA1234567"
            value={identityNo}
            onChange={(e) => onIdentityNoChange(e.target.value)}
            className="w-full rounded border border-line bg-surface px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="space-y-1 text-xs font-medium text-ink">
          <span>ไฟล์สแกน / รูปถ่ายบัตรประชาชนหรือพาสปอร์ต (JPG, PNG, PDF)</span>
          <input
            type="file"
            aria-label="อัปโหลดไฟล์สแกนบัตรหรือพาสปอร์ต"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            disabled={uploading}
            onChange={(e) => void handleFileSelect(e)}
            className="w-full rounded border border-line bg-surface px-2 py-1.5 text-xs text-ink file:mr-2 file:rounded file:border-0 file:bg-brand file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-white"
          />
        </label>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {uploading && <p className="text-xs text-ink-muted">กำลังอัปโหลดไฟล์สแกน...</p>}
      {!entityId && pendingFile && (
        <div className="flex items-center justify-between rounded border border-brand/30 bg-surface px-3 py-1.5 text-xs">
          <span className="text-ink">📎 เตรียมแนบไฟล์สแกน: <strong>{pendingFile.name}</strong></span>
          <button type="button" onClick={() => onPendingFileChange?.(null)} className="text-danger hover:underline">
            เอาออก
          </button>
        </div>
      )}
      {files.length > 0 && (
        <ul className="space-y-1.5 pt-1">
          {files.map((f) => (
            <li key={f.id} className="flex items-center justify-between rounded border border-line bg-surface px-3 py-1.5 text-xs">
              <a
                href={`${API_URL}/api/v1/files/${f.id}/raw`}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-brand hover:underline"
              >
                📄 {f.originalName} (คลิกเปิดดูไฟล์สแกน ↗)
              </a>
              <button type="button" onClick={() => void handleRemove(f.id)} className="text-danger hover:underline">
                ลบไฟล์
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
