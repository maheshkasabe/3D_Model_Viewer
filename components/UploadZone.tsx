"use client";

import JSZip from "jszip";
import { useCallback, useMemo, useRef, useState } from "react";

const SUPPORTED_EXTENSIONS = [
  "glb",
  "gltf",
  "fbx",
  "obj",
  "mtl",
  "zip",
  "bin",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "bmp",
  "gif",
  "tga",
  "dds",
] as const;
const MODEL_EXTENSIONS = ["glb", "gltf", "fbx", "obj", "zip"] as const;

type UploadZoneProps = {
  onUploadComplete: (file: File) => void;
  onUploadError: (message: string) => void;
};

function extensionFromName(name: string): string {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function isSupportedFile(file: File): boolean {
  return SUPPORTED_EXTENSIONS.includes(
    extensionFromName(file.name) as (typeof SUPPORTED_EXTENSIONS)[number],
  );
}

async function readWithProgress(file: File, onProgress: (progress: number) => void): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    reader.onerror = () => {
      reject(new Error("Failed to read file."));
    };
    reader.onload = () => {
      const buffer = reader.result;
      if (!(buffer instanceof ArrayBuffer)) {
        reject(new Error("Invalid file content."));
        return;
      }
      onProgress(100);
      resolve(new File([buffer], file.name, { type: file.type || "application/octet-stream" }));
    };
    reader.readAsArrayBuffer(file);
  });
}

export default function UploadZone({ onUploadComplete, onUploadError }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const acceptedString = useMemo(
    () => SUPPORTED_EXTENSIONS.map((ext) => `.${ext}`).join(","),
    [],
  );

  const processFiles = useCallback(
    async (incoming: FileList | File[]) => {
      const files = Array.from(incoming);
      if (files.length === 0) {
        return;
      }

      const supportedFiles = files.filter(isSupportedFile);
      if (supportedFiles.length === 0) {
        onUploadError("Unsupported format. Use GLB, GLTF, FBX, OBJ+MTL, or ZIP.");
        return;
      }

      const latestModel = [...supportedFiles]
        .reverse()
        .find((file) =>
          MODEL_EXTENSIONS.includes(
            extensionFromName(file.name) as (typeof MODEL_EXTENSIONS)[number],
          ),
        );

      if (!latestModel) {
        onUploadError("No model file found. Include one of: GLB, GLTF, FBX, OBJ, ZIP.");
        return;
      }

      try {
        setProgress(0);
        let preparedFile: File;
        const modelExtension = extensionFromName(latestModel.name);

        if (
          (modelExtension === "obj" || modelExtension === "fbx" || modelExtension === "gltf") &&
          supportedFiles.length > 1
        ) {
          const zip = new JSZip();
          for (const file of supportedFiles) {
            const arrayBuffer = await file.arrayBuffer();
            zip.file(file.name, arrayBuffer);
          }

          const zipBlob = await zip.generateAsync(
            { type: "blob", compression: "DEFLATE" },
            (metadata) => {
              setProgress(Math.round(metadata.percent));
            },
          );
          preparedFile = new File([zipBlob], `${latestModel.name}.zip`, {
            type: "application/zip",
          });
        } else {
          preparedFile = await readWithProgress(latestModel, setProgress);
        }

        onUploadComplete(preparedFile);
      } catch (error) {
        onUploadError(error instanceof Error ? error.message : "Unable to process upload.");
      } finally {
        setTimeout(() => setProgress(null), 400);
      }
    },
    [onUploadComplete, onUploadError],
  );

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple
        accept={acceptedString}
        onChange={(event) => {
          if (event.target.files) {
            void processFiles(event.target.files);
          }
        }}
      />
      <button
        type="button"
        className={`w-full rounded-xl border border-dashed px-4 py-10 text-left transition ${
          isDragging
            ? "border-blue-400 bg-blue-500/10"
            : "border-zinc-700 bg-zinc-900/40 hover:border-zinc-500 hover:bg-zinc-900/60"
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          void processFiles(event.dataTransfer.files);
        }}
      >
        <p className="text-sm font-medium text-zinc-100">Drop model files here</p>
        <p className="mt-1 text-xs text-zinc-400">
          Supports .glb, .gltf, .fbx, .obj + .mtl, and .zip
        </p>
      </button>
      {progress !== null && (
        <div className="space-y-1">
          <div className="h-2 w-full overflow-hidden rounded bg-zinc-800">
            <div
              className="h-full rounded bg-blue-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-zinc-400">Upload progress: {progress}%</p>
        </div>
      )}
    </div>
  );
}
