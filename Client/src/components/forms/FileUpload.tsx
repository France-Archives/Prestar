import { useId, type ChangeEvent } from "react";
import { COR_UPLOAD } from "@/utils/constants";

interface FileUploadProps {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
  error?: string | null;
  hint?: string;
  accept?: string;
}

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Picks a single file. Validation (type and size) is done by the caller with validateCorFile.
export default function FileUpload({
  label,
  file,
  onChange,
  error,
  hint,
  accept = COR_UPLOAD.ALLOWED_EXTENSIONS.join(","),
}: FileUploadProps) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;

  const handle = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.files?.[0] ?? null);
  };

  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="input"
        style={{ paddingTop: 7 }}
        type="file"
        accept={accept}
        onChange={handle}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
      />
      {file && (
        <span className="subtle">
          {file.name} · {formatSize(file.size)}
        </span>
      )}
      {error ? (
        <span id={`${id}-err`} className="error" role="alert">
          {error}
        </span>
      ) : (
        hint && (
          <span id={`${id}-hint`} className="hint">
            {hint}
          </span>
        )
      )}
    </div>
  );
}