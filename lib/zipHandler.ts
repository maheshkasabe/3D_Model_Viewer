import JSZip from "jszip";

export type ZipExtractionResult = {
  mainModelPath: string;
  pathToUrl: Map<string, string>;
  textFiles: Map<string, string>;
  revokeUrls: () => void;
};

const MODEL_EXTENSIONS = [".glb", ".gltf", ".fbx", ".obj"];

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.?\//, "").toLowerCase();
}

function hasModelExtension(path: string): boolean {
  const lowerPath = path.toLowerCase();
  return MODEL_EXTENSIONS.some((ext) => lowerPath.endsWith(ext));
}

export async function extractZipFile(file: Blob): Promise<ZipExtractionResult> {
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  if (entries.length === 0) {
    throw new Error("ZIP archive is empty.");
  }

  const objectUrls: string[] = [];
  const pathToUrl = new Map<string, string>();
  const textFiles = new Map<string, string>();

  let mainModelPath: string | null = null;
  for (const entry of entries) {
    const normalizedPath = normalizePath(entry.name);
    const contentBlob = await entry.async("blob");
    const objectUrl = URL.createObjectURL(contentBlob);
    objectUrls.push(objectUrl);
    pathToUrl.set(normalizedPath, objectUrl);

    if (normalizedPath.endsWith(".obj") || normalizedPath.endsWith(".mtl")) {
      textFiles.set(normalizedPath, await entry.async("text"));
    }

    if (hasModelExtension(normalizedPath)) {
      mainModelPath = normalizedPath;
    }
  }

  if (!mainModelPath) {
    for (const url of objectUrls) {
      URL.revokeObjectURL(url);
    }
    throw new Error("ZIP does not contain a supported model file.");
  }

  return {
    mainModelPath,
    pathToUrl,
    textFiles,
    revokeUrls: () => {
      for (const url of objectUrls) {
        URL.revokeObjectURL(url);
      }
    },
  };
}

export function splitPath(path: string): { directory: string; fileName: string } {
  const normalized = path.replace(/\\/g, "/");
  const lastSlashIndex = normalized.lastIndexOf("/");
  if (lastSlashIndex < 0) {
    return { directory: "", fileName: normalized };
  }
  return {
    directory: normalized.slice(0, lastSlashIndex + 1),
    fileName: normalized.slice(lastSlashIndex + 1),
  };
}

export function joinArchivePath(baseDirectory: string, targetPath: string): string {
  const raw = `${baseDirectory}${targetPath}`.replace(/\\/g, "/");
  const segments = raw.split("/");
  const resolved: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === ".") {
      continue;
    }
    if (segment === "..") {
      resolved.pop();
      continue;
    }
    resolved.push(segment);
  }

  return resolved.join("/").toLowerCase();
}
