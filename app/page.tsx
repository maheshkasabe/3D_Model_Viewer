"use client";

import UploadZone from "@/components/UploadZone";
import Viewer from "@/components/Viewer";
import { useViewerStore } from "@/store/viewerStore";
import { useState } from "react";

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function extension(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : "UNKNOWN";
}

type SampleModel = {
  label: string;
  remoteUrl: string;
  localUrl?: string;
};

const SAMPLE_MODELS: SampleModel[] = [
  {
    label: "ISS Stationary",
    remoteUrl: "https://bvildr-3dassets.s3.eu-north-1.amazonaws.com/ISS_stationary.glb",
    localUrl: "/models/ISS_stationary.glb",
  },
  {
    label: "Damaged Helmet",
    remoteUrl:
      "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/DamagedHelmet/glTF-Binary/DamagedHelmet.glb",
  },
  {
    label: "General Ship Repair",
    remoteUrl: "https://bvildr-3dassets.s3.eu-north-1.amazonaws.com/general_ship_repair.glb",
    localUrl: "/models/general_ship_repair.glb",
  },
];

function fileNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] ?? "sample-model.glb";
  } catch {
    return "sample-model.glb";
  }
}

export default function Home() {
  const {
    currentAsset,
    wireframe,
    showGrid,
    showAxes,
    walkMode,
    measureMode,
    errorMessage,
    toggleWireframe,
    toggleGrid,
    toggleAxes,
    toggleWalkMode,
    toggleMeasureMode,
    resetCamera,
    zoomIn,
    zoomOut,
    setCurrentAsset,
    setErrorMessage,
  } = useViewerStore();
  const [loadingSampleUrl, setLoadingSampleUrl] = useState<string | null>(null);

  const fetchSampleBlob = async (url: string): Promise<Blob> => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Sample download failed (${response.status}) from ${url}.`);
    }
    return response.blob();
  };

  const loadSampleModel = async (sample: SampleModel) => {
    try {
      setLoadingSampleUrl(sample.remoteUrl);
      setErrorMessage(null);
      let blob: Blob;
      let sourceUrl = sample.remoteUrl;

      try {
        blob = await fetchSampleBlob(sample.remoteUrl);
      } catch (remoteError) {
        if (!sample.localUrl) {
          throw remoteError;
        }
        blob = await fetchSampleBlob(sample.localUrl);
        sourceUrl = sample.localUrl;
      }

      const name = fileNameFromUrl(sourceUrl);
      const file = new File([blob], name, {
        type: blob.type || "model/gltf-binary",
      });
      setCurrentAsset({
        file,
        name: file.name,
        size: file.size,
        format: extension(file.name),
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? `${error.message} If this is Vercel, make sure the model exists in public/models or configure AWS CORS for your domain.`
          : "Failed to load sample model.",
      );
    } finally {
      setLoadingSampleUrl(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3 sm:px-6">
        <div>
          <h1 className="text-sm font-semibold tracking-wide">3D Model Viewer</h1>
          <p className="text-xs text-zinc-400">Upload and preview GLB, GLTF, FBX, OBJ/MTL, ZIP</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800"
            onClick={resetCamera}
          >
            Reset Camera
          </button>
          <button
            type="button"
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800"
            onClick={zoomOut}
          >
            -
          </button>
          <button
            type="button"
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs hover:bg-zinc-800"
            onClick={zoomIn}
          >
            +
          </button>
          <button
            type="button"
            className={`rounded-md border px-3 py-1.5 text-xs ${
              wireframe
                ? "border-blue-500 bg-blue-500/20 text-blue-100"
                : "border-zinc-700 hover:bg-zinc-800"
            }`}
            onClick={toggleWireframe}
          >
            Wireframe
          </button>
          <button
            type="button"
            className={`rounded-md border px-3 py-1.5 text-xs ${
              showGrid
                ? "border-blue-500 bg-blue-500/20 text-blue-100"
                : "border-zinc-700 hover:bg-zinc-800"
            }`}
            onClick={toggleGrid}
          >
            Grid
          </button>
          <button
            type="button"
            className={`rounded-md border px-3 py-1.5 text-xs ${
              showAxes
                ? "border-blue-500 bg-blue-500/20 text-blue-100"
                : "border-zinc-700 hover:bg-zinc-800"
            }`}
            onClick={toggleAxes}
          >
            Axes
          </button>
          <button
            type="button"
            className={`rounded-md border px-3 py-1.5 text-xs ${
              walkMode
                ? "border-blue-500 bg-blue-500/20 text-blue-100"
                : "border-zinc-700 hover:bg-zinc-800"
            }`}
            onClick={toggleWalkMode}
          >
            Walk Mode
          </button>
          <button
            type="button"
            className={`rounded-md border px-3 py-1.5 text-xs ${
              measureMode
                ? "border-blue-500 bg-blue-500/20 text-blue-100"
                : "border-zinc-700 hover:bg-zinc-800"
            }`}
            onClick={toggleMeasureMode}
          >
            Measure Angles
          </button>
        </div>
      </header>

      <main className="grid flex-1 grid-cols-1 gap-4 p-4 sm:p-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <UploadZone
            onUploadComplete={(file) => {
              setCurrentAsset({
                file,
                name: file.name,
                size: file.size,
                format: extension(file.name),
              });
            }}
            onUploadError={setErrorMessage}
          />
          <section className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Sample Models
            </p>
            <p className="text-xs text-zinc-500">Load a model instantly without uploading files.</p>
            <div className="grid gap-2">
              {SAMPLE_MODELS.map((sample) => (
                <button
                  key={sample.remoteUrl}
                  type="button"
                  className="rounded-md border border-zinc-700 px-3 py-1.5 text-left text-xs hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => {
                    void loadSampleModel(sample);
                  }}
                  disabled={loadingSampleUrl !== null}
                >
                  {loadingSampleUrl === sample.remoteUrl
                    ? `Loading ${sample.label}...`
                    : sample.label}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">File Info</p>
            {currentAsset ? (
              <>
                <p className="text-sm font-medium text-zinc-100">{currentAsset.name}</p>
                <p className="text-xs text-zinc-400">Size: {formatBytes(currentAsset.size)}</p>
                <p className="text-xs text-zinc-400">Format: {currentAsset.format}</p>
              </>
            ) : (
              <p className="text-xs text-zinc-500">No model loaded yet.</p>
            )}
          </section>

          {errorMessage ? (
            <div className="rounded-lg border border-red-700/70 bg-red-950/70 p-3 text-xs text-red-200">
              {errorMessage}
            </div>
          ) : null}
        </aside>

        <section className="min-h-[440px]">
          <Viewer />
        </section>
      </main>
    </div>
  );
}
