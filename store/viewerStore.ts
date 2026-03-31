"use client";

import { create } from "zustand";

export type UploadedAsset = {
  file: File;
  name: string;
  size: number;
  format: string;
};

type ViewerState = {
  wireframe: boolean;
  showGrid: boolean;
  showAxes: boolean;
  walkMode: boolean;
  measureMode: boolean;
  resetSignal: number;
  zoomSignal: number;
  currentAsset: UploadedAsset | null;
  errorMessage: string | null;
  setCurrentAsset: (asset: UploadedAsset | null) => void;
  setErrorMessage: (message: string | null) => void;
  toggleWireframe: () => void;
  toggleGrid: () => void;
  toggleAxes: () => void;
  toggleWalkMode: () => void;
  toggleMeasureMode: () => void;
  resetCamera: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
};

export const useViewerStore = create<ViewerState>((set) => ({
  wireframe: false,
  showGrid: true,
  showAxes: true,
  walkMode: false,
  measureMode: false,
  resetSignal: 0,
  zoomSignal: 0,
  currentAsset: null,
  errorMessage: null,
  setCurrentAsset: (asset) => set({ currentAsset: asset, errorMessage: null }),
  setErrorMessage: (message) => set({ errorMessage: message }),
  toggleWireframe: () => set((state) => ({ wireframe: !state.wireframe })),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  toggleAxes: () => set((state) => ({ showAxes: !state.showAxes })),
  toggleWalkMode: () => set((state) => ({ walkMode: !state.walkMode })),
  toggleMeasureMode: () => set((state) => ({ measureMode: !state.measureMode })),
  resetCamera: () => set((state) => ({ resetSignal: state.resetSignal + 1 })),
  zoomIn: () => set((state) => ({ zoomSignal: state.zoomSignal + 1 })),
  zoomOut: () => set((state) => ({ zoomSignal: state.zoomSignal - 1 })),
}));
