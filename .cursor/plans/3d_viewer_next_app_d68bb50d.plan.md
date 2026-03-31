---
name: 3D Viewer Next App
overview: Scaffold a production-ready Next.js App Router TypeScript app and implement a complete multi-format 3D upload/view pipeline (GLTF/GLB, FBX, OBJ/MTL, ZIP) with robust error handling, performance safeguards, and modern Tailwind UI.
todos:
  - id: scaffold-next-tailwind
    content: Initialize Next.js TypeScript App Router project with Tailwind and install required 3D/zip/state dependencies
    status: completed
  - id: build-upload-and-state
    content: Implement UploadZone, file metadata/progress flow, and shared UI/viewer state management
    status: completed
  - id: build-loader-stack
    content: Implement unified model loader with format-specific adapters and ZIP extraction/path resolution
    status: completed
  - id: build-r3f-viewer
    content: Implement Canvas-based viewer with controls, framing, helpers, wireframe/reset features, and fallback UIs
    status: completed
  - id: validate-and-harden
    content: Add cleanup/error handling/performance safeguards and verify with lint/typecheck/dev run
    status: completed
isProject: false
---

# Build Production 3D Model Viewer

## Scope

Create a fully working Next.js (latest, App Router, TypeScript) web app from an empty workspace that supports drag-and-drop uploads, multi-format model parsing, ZIP extraction with texture resolution, and interactive browser rendering using React Three Fiber.

## Implementation Steps

1. Scaffold and baseline configuration

- Initialize a new Next.js App Router TypeScript project in the current workspace with Tailwind.
- Install runtime dependencies: `three`, `@react-three/fiber`, `@react-three/drei`, `zustand`, `jszip`, and supporting Three examples loaders.
- Configure strict TypeScript and cleanup boilerplate so the app starts from a focused single-page viewer.

1. Create app layout and UI shell

- Build a responsive two-panel layout in `[/Users/mahesh/Developer/Diligent_Insight/3D/app/page.tsx](/Users/mahesh/Developer/Diligent_Insight/3D/app/page.tsx)`: top toolbar, left upload/info panel, right full viewer area.
- Add modern dark-mode-compatible Tailwind styling and mobile-friendly behavior.
- Wire global UI state (wireframe, grid, reset camera trigger, current file metadata) through a small Zustand store.

1. Implement upload pipeline

- Build `[/Users/mahesh/Developer/Diligent_Insight/3D/components/UploadZone.tsx](/Users/mahesh/Developer/Diligent_Insight/3D/components/UploadZone.tsx)` with drag-drop + click upload, multi-file support (load latest), client-side format validation, and progress visualization.
- Create object URL lifecycle management (revoke old URLs when replacing files) and emit normalized file payload to the viewer.

1. Implement unified model loading abstraction

- Build `[/Users/mahesh/Developer/Diligent_Insight/3D/hooks/useModelLoader.ts](/Users/mahesh/Developer/Diligent_Insight/3D/hooks/useModelLoader.ts)` exposing:
  - `scene`
  - `loading`
  - `error`
- Detect file type and route to loader adapters in `[/Users/mahesh/Developer/Diligent_Insight/3D/lib/loaders.ts](/Users/mahesh/Developer/Diligent_Insight/3D/lib/loaders.ts)`:
  - GLTF/GLB with DRACO support
  - FBX via `FBXLoader`
  - OBJ/MTL via `OBJLoader` + `MTLLoader`
- Ensure all outputs normalize to a `THREE.Object3D`/`THREE.Group` scene root and report actionable error messages.

1. Implement ZIP extraction and path resolution

- Build `[/Users/mahesh/Developer/Diligent_Insight/3D/lib/zipHandler.ts](/Users/mahesh/Developer/Diligent_Insight/3D/lib/zipHandler.ts)` with JSZip to:
  - Extract files
  - Identify primary model asset
  - Map archive-relative file paths to blob URLs
  - Resolve relative references for MTL textures and nested folders
- Integrate URL map into loader resource resolution, including common case-insensitive path mismatches.

1. Implement rendering components

- Build `[/Users/mahesh/Developer/Diligent_Insight/3D/components/Model.tsx](/Users/mahesh/Developer/Diligent_Insight/3D/components/Model.tsx)` to consume `useModelLoader`, apply wireframe toggle traversal, and dispose geometry/materials/textures on unmount.
- Build `[/Users/mahesh/Developer/Diligent_Insight/3D/components/Viewer.tsx](/Users/mahesh/Developer/Diligent_Insight/3D/components/Viewer.tsx)` with:
  - R3F `Canvas`
  - `OrbitControls`
  - ambient + directional lights
  - optional grid + axes helper
  - auto-centering and camera framing from model bounding box
  - loading fallback (`Suspense`) and error fallback panel

1. Controls and interactions

- Add top-bar actions:
  - reset camera
  - wireframe toggle
  - grid toggle
- Ensure reset action works reliably after model replacement and after bounding-box reframing.

1. Hardening and validation

- Handle edge cases: unsupported extension, broken ZIP, missing sidecar MTL, missing textures, invalid meshes.
- Add defensive cleanup for all generated blob URLs and loader-owned resources to avoid leaks.
- Run lint/type checks and fix issues until project runs clean with `npm run dev`.

## Key Files To Deliver

- `[/Users/mahesh/Developer/Diligent_Insight/3D/app/page.tsx](/Users/mahesh/Developer/Diligent_Insight/3D/app/page.tsx)`
- `[/Users/mahesh/Developer/Diligent_Insight/3D/components/Viewer.tsx](/Users/mahesh/Developer/Diligent_Insight/3D/components/Viewer.tsx)`
- `[/Users/mahesh/Developer/Diligent_Insight/3D/components/Model.tsx](/Users/mahesh/Developer/Diligent_Insight/3D/components/Model.tsx)`
- `[/Users/mahesh/Developer/Diligent_Insight/3D/components/UploadZone.tsx](/Users/mahesh/Developer/Diligent_Insight/3D/components/UploadZone.tsx)`
- `[/Users/mahesh/Developer/Diligent_Insight/3D/hooks/useModelLoader.ts](/Users/mahesh/Developer/Diligent_Insight/3D/hooks/useModelLoader.ts)`
- `[/Users/mahesh/Developer/Diligent_Insight/3D/lib/loaders.ts](/Users/mahesh/Developer/Diligent_Insight/3D/lib/loaders.ts)`
- `[/Users/mahesh/Developer/Diligent_Insight/3D/lib/zipHandler.ts](/Users/mahesh/Developer/Diligent_Insight/3D/lib/zipHandler.ts)`
- project config files generated by Next.js/Tailwind scaffolding (`package.json`, `tsconfig.json`, `next.config.*`, `postcss.config.*`, `tailwind.config.*`, `app/globals.css`)

