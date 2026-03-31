"use client";

import { useEffect, useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { useModelLoader } from "@/hooks/useModelLoader";

type ModelProps = {
  file: File;
  wireframe: boolean;
  measureMode: boolean;
  onPickPoint: (point: THREE.Vector3) => void;
  onReady: (object: THREE.Object3D) => void;
  onError: (message: string | null) => void;
  onLoadingChange: (loading: boolean) => void;
  onWarnings: (messages: string[]) => void;
};

function supportsWireframe(material: THREE.Material): material is THREE.Material & { wireframe: boolean } {
  return "wireframe" in material;
}

function normalizeMaterial(material: THREE.Material): void {
  const typed = material as THREE.Material & {
    map?: THREE.Texture | null;
    emissiveMap?: THREE.Texture | null;
    wireframe?: boolean;
  };

  // Many imported non-GLTF materials need explicit color-space assignment.
  if (typed.map) {
    typed.map.colorSpace = THREE.SRGBColorSpace;
    typed.map.needsUpdate = true;
  }
  if (typed.emissiveMap) {
    typed.emissiveMap.colorSpace = THREE.SRGBColorSpace;
    typed.emissiveMap.needsUpdate = true;
  }
}

export default function Model({
  file,
  wireframe,
  measureMode,
  onPickPoint,
  onReady,
  onError,
  onLoadingChange,
  onWarnings,
}: ModelProps) {
  const { scene, loading, error, warnings } = useModelLoader(file);
  const renderedObject = useMemo(() => scene, [scene]);

  useEffect(() => {
    onLoadingChange(loading);
  }, [loading, onLoadingChange]);

  useEffect(() => {
    onError(error);
  }, [error, onError]);

  useEffect(() => {
    if (!renderedObject) {
      onWarnings(warnings);
      return;
    }

    let materialCount = 0;
    let texturedMaterialCount = 0;
    renderedObject.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) {
        return;
      }
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        materialCount += 1;
        const typed = material as THREE.Material & { map?: THREE.Texture | null };
        if (typed.map) {
          texturedMaterialCount += 1;
        }
      }
    });

    const runtimeWarnings = [...warnings];
    if (materialCount > 0 && texturedMaterialCount === 0) {
      runtimeWarnings.push(
        "No texture maps detected in loaded materials. Model may be color-only or texture references were not resolved.",
      );
    }

    onWarnings(runtimeWarnings);
  }, [warnings, onWarnings, renderedObject]);

  useEffect(() => {
    if (!renderedObject) {
      return;
    }

    renderedObject.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) {
        return;
      }

      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        normalizeMaterial(material);
        if (supportsWireframe(material)) {
          material.wireframe = wireframe;
        }
        material.needsUpdate = true;
      }
    });
    onReady(renderedObject);
  }, [onReady, renderedObject, wireframe]);

  if (!renderedObject || error) {
    return null;
  }

  return (
    <primitive
      object={renderedObject}
      onPointerDown={(event: ThreeEvent<PointerEvent>) => {
        if (!measureMode) {
          return;
        }
        event.stopPropagation();
        onPickPoint(event.point.clone());
      }}
    />
  );
}
