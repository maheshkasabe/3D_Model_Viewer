import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { extractZipFile, joinArchivePath, splitPath } from "@/lib/zipHandler";

export type ModelLoadResult = {
  scene: THREE.Object3D;
  warnings: string[];
  cleanup: () => void;
};

function extensionOf(name: string): string {
  const segments = name.toLowerCase().split(".");
  return segments.length > 1 ? segments[segments.length - 1] : "";
}

function normalizeArchivePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.?\//, "").toLowerCase();
}

function baseName(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(index + 1).toLowerCase() : normalized.toLowerCase();
}

function createLoadingManager(
  resolver: (url: string) => string,
  warnings: string[],
): THREE.LoadingManager {
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => resolver(url));
  manager.onError = (url) => {
    warnings.push(`Missing referenced asset: ${url}`);
  };
  return manager;
}

async function parseGltf(
  data: ArrayBuffer,
  manager: THREE.LoadingManager,
): Promise<THREE.Object3D> {
  const loader = new GLTFLoader(manager);
  const dracoLoader = new DRACOLoader(manager);
  dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
  loader.setDRACOLoader(dracoLoader);

  return new Promise((resolve, reject) => {
    loader.parse(
      data,
      "",
      (gltf) => {
        dracoLoader.dispose();
        resolve(gltf.scene);
      },
      (error) => {
        dracoLoader.dispose();
        reject(error);
      },
    );
  });
}

async function parseFbx(
  data: ArrayBuffer,
  manager?: THREE.LoadingManager,
  resourcePath = "",
): Promise<THREE.Object3D> {
  try {
    const loader = new FBXLoader(manager);
    loader.setPath(resourcePath);
    loader.setResourcePath(resourcePath);
    return loader.parse(data, resourcePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("FBX version not supported") || message.includes("FileVersion: 6100")) {
      throw new Error(
        "This FBX file uses an old format (version 6100) unsupported by this viewer. Convert it to a newer FBX (2013+ / 7.x) or GLB, then upload again.",
      );
    }
    throw error;
  }
}

function findMtllibReferences(objText: string): string[] {
  const lines = objText.split(/\r?\n/);
  const references: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.toLowerCase().startsWith("mtllib ")) {
      continue;
    }
    const mtlPath = trimmed.slice(7).trim();
    if (mtlPath) {
      references.push(mtlPath);
    }
  }
  return references;
}

async function parseObj(
  objText: string,
  manager: THREE.LoadingManager,
  mtlText: string | null,
  mtlDir: string,
): Promise<THREE.Object3D> {
  const objLoader = new OBJLoader(manager);

  if (mtlText) {
    const materialLoader = new MTLLoader(manager);
    materialLoader.setPath(mtlDir);
    const materials = materialLoader.parse(mtlText, mtlDir);
    materials.preload();
    objLoader.setMaterials(materials);
  }

  return objLoader.parse(objText);
}

export async function loadModel(file: File): Promise<ModelLoadResult> {
  const warnings: string[] = [];
  const ext = extensionOf(file.name);
  const cleanupTasks: Array<() => void> = [];

  try {
    if (ext === "zip") {
      const extracted = await extractZipFile(file);
      cleanupTasks.push(extracted.revokeUrls);
      const { directory, fileName } = splitPath(extracted.mainModelPath);
      const mainExt = extensionOf(fileName);

      const resolveFromArchive = (requested: string, fromDir = directory): string => {
        if (/^(blob:|data:|https?:)/i.test(requested)) {
          return requested;
        }

        const directPath = normalizeArchivePath(requested);
        const direct = extracted.pathToUrl.get(directPath);
        if (direct) {
          return direct;
        }

        const normalized = joinArchivePath(fromDir, requested);
        const joined = extracted.pathToUrl.get(normalized);
        if (joined) {
          return joined;
        }

        const requestedFile = baseName(requested);
        const filenameMatches = [...extracted.pathToUrl.entries()].filter(([path]) =>
          path.endsWith(`/${requestedFile}`) || path === requestedFile,
        );
        if (filenameMatches.length === 1) {
          warnings.push(`Resolved by filename fallback: ${requested}`);
          return filenameMatches[0][1];
        }

        warnings.push(`Unable to resolve path in ZIP: ${requested}`);
        return requested;
      };

      const mainUrl = extracted.pathToUrl.get(extracted.mainModelPath);
      if (!mainUrl) {
        throw new Error("Could not resolve the main model file in ZIP archive.");
      }

      if (mainExt === "glb" || mainExt === "gltf") {
        const data = await fetch(mainUrl).then((response) => response.arrayBuffer());
        const manager = createLoadingManager((url) => resolveFromArchive(url), warnings);
        const scene = await parseGltf(data, manager);
        return { scene, warnings, cleanup: () => cleanupTasks.forEach((fn) => fn()) };
      }

      if (mainExt === "fbx") {
        const data = await fetch(mainUrl).then((response) => response.arrayBuffer());
        const manager = createLoadingManager((url) => resolveFromArchive(url), warnings);
        const scene = await parseFbx(data, manager, directory);
        return { scene, warnings, cleanup: () => cleanupTasks.forEach((fn) => fn()) };
      }

      if (mainExt === "obj") {
        const objText = extracted.textFiles.get(extracted.mainModelPath);
        if (!objText) {
          throw new Error("OBJ text could not be read from ZIP.");
        }
        const references = findMtllibReferences(objText);
        const mtlRelativePath = references[0] ?? "";
        const mtlPath = mtlRelativePath ? joinArchivePath(directory, mtlRelativePath) : "";
        const mtlText = mtlPath ? extracted.textFiles.get(mtlPath) ?? null : null;
        if (references.length > 0 && !mtlText) {
          warnings.push(`Missing MTL file: ${references[0]}`);
        }
        const manager = createLoadingManager(
          (url) => resolveFromArchive(url, mtlPath ? splitPath(mtlPath).directory : directory),
          warnings,
        );
        const scene = await parseObj(
          objText,
          manager,
          mtlText,
          mtlPath ? splitPath(mtlPath).directory : directory,
        );
        return { scene, warnings, cleanup: () => cleanupTasks.forEach((fn) => fn()) };
      }

      throw new Error("Unsupported format. Use GLB, GLTF, FBX, OBJ+MTL, or ZIP.");
    }

    if (ext === "glb" || ext === "gltf") {
      const data = await file.arrayBuffer();
      const manager = createLoadingManager((url) => url, warnings);
      const scene = await parseGltf(data, manager);
      return { scene, warnings, cleanup: () => cleanupTasks.forEach((fn) => fn()) };
    }

    if (ext === "fbx") {
      const data = await file.arrayBuffer();
      const scene = await parseFbx(data);
      return { scene, warnings, cleanup: () => cleanupTasks.forEach((fn) => fn()) };
    }

    if (ext === "obj") {
      const objText = await file.text();
      const manager = createLoadingManager((url) => url, warnings);
      const scene = await parseObj(objText, manager, null, "");
      warnings.push("OBJ loaded without MTL. Drop OBJ+MTL together or use ZIP for textures.");
      return { scene, warnings, cleanup: () => cleanupTasks.forEach((fn) => fn()) };
    }

    throw new Error("Unsupported format. Use GLB, GLTF, FBX, OBJ+MTL, or ZIP.");
  } catch (error) {
    cleanupTasks.forEach((fn) => fn());
    throw error;
  }
}
