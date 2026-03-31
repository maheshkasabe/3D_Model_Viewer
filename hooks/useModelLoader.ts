"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import { loadModel } from "@/lib/loaders";

export type UseModelLoaderResult = {
  scene: THREE.Object3D | null;
  loading: boolean;
  error: string | null;
  warnings: string[];
};

function toMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Failed to load model.";
}

export function useModelLoader(file: File | Blob | null): UseModelLoaderResult {
  const [scene, setScene] = useState<THREE.Object3D | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    let isCancelled = false;
    let cleanup: (() => void) | null = null;
    let previousScene: THREE.Object3D | null = null;

    const run = async () => {
      if (!(file instanceof File)) {
        setScene(null);
        setLoading(false);
        setError(null);
        setWarnings([]);
        return;
      }

      setLoading(true);
      setError(null);
      setWarnings([]);
      setScene((current) => {
        previousScene = current;
        return null;
      });

      try {
        const result = await loadModel(file);
        if (isCancelled) {
          result.cleanup();
          return;
        }
        cleanup = result.cleanup;
        setScene(result.scene);
        setWarnings(result.warnings);
      } catch (loadError) {
        if (!isCancelled) {
          setError(toMessage(loadError));
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      isCancelled = true;
      cleanup?.();
      if (previousScene) {
        previousScene.traverse((node) => {
          const mesh = node as THREE.Mesh;
          if (!mesh.isMesh) {
            return;
          }
          mesh.geometry.dispose();
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((material) => {
            material.dispose();
          });
        });
      }
    };
  }, [file]);

  return { scene, loading, error, warnings };
}
