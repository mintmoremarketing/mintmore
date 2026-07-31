import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../Icon";

const defaultAcceptedFormats = ["jpg", "jpeg", "png", "webp", "pdf", "doc", "docx", "zip"];

function getExtension(fileName) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function getFileKind(file) {
  const extension = getExtension(file.name);
  if (file.type.startsWith("image/")) return "image";
  if (extension === "pdf") return "pdf";
  if (["doc", "docx"].includes(extension)) return "word";
  if (["zip", "rar", "7z"].includes(extension)) return "archive";
  return "file";
}

function formatAcceptedFormats(formats) {
  return formats.map((format) => format.toUpperCase()).join(", ");
}

function getKindIcon(kind) {
  return <Icon name="file" size={24} style={{ color: "var(--ink-400)" }} />;
}

function createUploadItem(file) {
  const kind = getFileKind(file);
  return {
    id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
    file,
    name: file.name,
    size: file.size,
    type: file.type,
    kind,
    previewUrl: kind === "image" ? URL.createObjectURL(file) : undefined,
  };
}

export default function DocumentUploader({
  title = "Upload Files",
  uploadLabel = "Upload",
  description,
  acceptedFormats = defaultAcceptedFormats,
  maxFileSizeMb = 20,
  onFilesChange,
}) {
  const inputRef = useRef(null);
  const itemsRef = useRef([]);
  const [items, setItems] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  const accept = useMemo(
    () => acceptedFormats.map((format) => `.${format}`).join(","),
    [acceptedFormats],
  );
  const helperText = description ?? `${formatAcceptedFormats(acceptedFormats)}. Max ${maxFileSizeMb} MB.`;

  useEffect(() => {
    itemsRef.current = items;
    onFilesChange?.(items.map((item) => item.file));
  }, [items, onFilesChange]);

  useEffect(() => {
    return () => {
      itemsRef.current.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  const addFiles = (selectedFiles) => {
    const acceptedSet = new Set(acceptedFormats.map((format) => format.toLowerCase()));
    const maxBytes = maxFileSizeMb * 1024 * 1024;

    const nextItems = Array.from(selectedFiles)
      .filter((file) => {
        const extension = getExtension(file.name);
        const isAccepted = !acceptedSet.size || acceptedSet.has(extension);
        return isAccepted && file.size <= maxBytes;
      })
      .map(createUploadItem);

    if (!nextItems.length) return;
    setItems((currentItems) => [...currentItems, ...nextItems]);
  };

  const removeItem = (id) => {
    setItems((currentItems) => {
      const removedItem = currentItems.find((item) => item.id === id);
      if (removedItem?.previewUrl) {
        URL.revokeObjectURL(removedItem.previewUrl);
      }
      return currentItems.filter((item) => item.id !== id);
    });
  };

  return (
    <div className="card h-auto w-full max-w-xl rounded-xl py-0 pt-0 pb-0 shadow-xs transition-all duration-300 ease-out bg-paper" style={{ padding: 16 }}>
      <div className="space-y-2 py-0">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            addFiles(event.dataTransfer.files);
          }}
          style={{
            minHeight: 160,
            border: `2px dashed ${isDragging ? 'var(--ink-950)' : 'var(--hairline-strong)'}`,
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            cursor: 'pointer',
            background: isDragging ? 'var(--ink-50)' : 'var(--paper-tint)',
            width: '100%',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ padding: '8px 16px', background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontWeight: 600, fontSize: 13, color: 'var(--ink-800)' }}>
            <Icon name="upload" size={16} />
            {uploadLabel}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-700)' }}>
            Choose files or drag & drop it here.
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--ink-400)' }}>{helperText}</p>
        </button>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          style={{ display: 'none' }}
          onChange={(event) => {
            if (event.target.files) addFiles(event.target.files);
            event.target.value = "";
          }}
        />

        {items.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginTop: 16 }}>
            {items.map((item) => (
              <div
                key={item.id}
                style={{ position: 'relative', aspectRatio: '1', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--hairline-strong)', background: 'var(--paper-tint)' }}
              >
                {item.previewUrl ? (
                  <img
                    src={item.previewUrl}
                    alt={item.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 8, gap: 8, textAlign: 'center' }}>
                    {getKindIcon(item.kind)}
                    <span style={{ fontSize: 11, color: 'var(--ink-500)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-all' }}>
                      {item.name}
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  style={{
                    position: 'absolute', top: 4, right: 4,
                    background: 'rgba(239, 68, 68, 0.9)', color: 'white',
                    border: 'none', borderRadius: '50%',
                    width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', zIndex: 10
                  }}
                >
                  <Icon name="x" size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
