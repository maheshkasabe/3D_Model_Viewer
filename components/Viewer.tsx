"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Grid, Html, Line, OrbitControls, PointerLockControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import Model from "@/components/Model";
import { useViewerStore } from "@/store/viewerStore";

type CameraControllerProps = {
  model: THREE.Object3D | null;
  resetSignal: number;
  controlsRef: { current: OrbitControlsImpl | null };
};

function CameraController({ model, resetSignal, controlsRef }: CameraControllerProps) {
  const initialState = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);

  useEffect(() => {
    if (!model || !controlsRef.current) {
      return;
    }

    const controls = controlsRef.current;
    const camera = controls.object as THREE.PerspectiveCamera;
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxSize = Math.max(size.x, size.y, size.z);
    const fitDistance =
      maxSize > 0
        ? maxSize / (2 * Math.tan((camera.fov * Math.PI) / 360)) + maxSize * 0.9
        : 4;

    const offset = new THREE.Vector3(fitDistance * 0.8, fitDistance * 0.6, fitDistance);
    camera.position.copy(center.clone().add(offset));
    camera.near = Math.max(fitDistance / 100, 0.01);
    camera.far = Math.max(fitDistance * 100, 1000);
    camera.updateProjectionMatrix();
    controls.target.copy(center);
    controls.update();

    initialState.current = {
      position: camera.position.clone(),
      target: controls.target.clone(),
    };
  }, [controlsRef, model]);

  useEffect(() => {
    if (!controlsRef.current || !initialState.current) {
      return;
    }
    const controls = controlsRef.current;
    const camera = controls.object as THREE.PerspectiveCamera;
    camera.position.copy(initialState.current.position);
    controls.target.copy(initialState.current.target);
    controls.update();
  }, [controlsRef, resetSignal]);

  return null;
}

function WalkController({ enabled }: { enabled: boolean }) {
  const { camera } = useThree();
  const pressed = useRef({ w: false, a: false, s: false, d: false });

  useEffect(() => {
    if (!enabled) {
      pressed.current = { w: false, a: false, s: false, d: false };
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "w" || key === "a" || key === "s" || key === "d") {
        pressed.current[key] = true;
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "w" || key === "a" || key === "s" || key === "d") {
        pressed.current[key] = false;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [enabled]);

  useFrame((_, delta) => {
    if (!enabled) {
      return;
    }
    const moveSpeed = 4 * delta;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() === 0) {
      return;
    }
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    if (pressed.current.w) {
      camera.position.addScaledVector(forward, moveSpeed);
    }
    if (pressed.current.s) {
      camera.position.addScaledVector(forward, -moveSpeed);
    }
    if (pressed.current.a) {
      camera.position.addScaledVector(right, moveSpeed);
    }
    if (pressed.current.d) {
      camera.position.addScaledVector(right, -moveSpeed);
    }
  });

  return enabled ? <PointerLockControls /> : null;
}

function angleAt(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): number {
  const ab = a.clone().sub(b).normalize();
  const cb = c.clone().sub(b).normalize();
  const dot = THREE.MathUtils.clamp(ab.dot(cb), -1, 1);
  return THREE.MathUtils.radToDeg(Math.acos(dot));
}

export default function Viewer() {
  const {
    currentAsset,
    wireframe,
    showGrid,
    showAxes,
    walkMode,
    measureMode,
    resetSignal,
    zoomSignal,
    setErrorMessage,
  } = useViewerStore();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const prevZoomSignal = useRef(0);
  const [modelObject, setModelObject] = useState<THREE.Object3D | null>(null);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [measurePoints, setMeasurePoints] = useState<THREE.Vector3[]>([]);

  const onModelError = useCallback(
    (message: string | null) => {
      setLocalError(message);
      setErrorMessage(message);
    },
    [setErrorMessage],
  );

  const warningText = useMemo(() => warnings.join(" "), [warnings]);
  const activeMeasurePoints = useMemo(
    () => (measureMode ? measurePoints : []),
    [measureMode, measurePoints],
  );
  const measureAngles = useMemo(() => {
    if (activeMeasurePoints.length < 3) {
      return null;
    }
    return [
      angleAt(activeMeasurePoints[1], activeMeasurePoints[0], activeMeasurePoints[2]),
      angleAt(activeMeasurePoints[0], activeMeasurePoints[1], activeMeasurePoints[2]),
      angleAt(activeMeasurePoints[0], activeMeasurePoints[2], activeMeasurePoints[1]),
    ];
  }, [activeMeasurePoints]);

  useEffect(() => {
    if (!controlsRef.current) {
      prevZoomSignal.current = zoomSignal;
      return;
    }
    const deltaSignal = zoomSignal - prevZoomSignal.current;
    if (deltaSignal === 0) {
      return;
    }
    const controls = controlsRef.current;
    const camera = controls.object as THREE.PerspectiveCamera;
    const toCamera = camera.position.clone().sub(controls.target);
    const steps = Math.abs(deltaSignal);
    for (let i = 0; i < steps; i += 1) {
      const scale = deltaSignal > 0 ? 0.85 : 1.15;
      toCamera.multiplyScalar(scale);
    }
    camera.position.copy(controls.target.clone().add(toCamera));
    controls.update();
    prevZoomSignal.current = zoomSignal;
  }, [zoomSignal]);

  const onPickPoint = useCallback(
    (point: THREE.Vector3) => {
      if (!measureMode) {
        return;
      }
      setMeasurePoints((current) => (current.length >= 3 ? [point] : [...current, point]));
    },
    [measureMode],
  );

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-zinc-800 bg-black/40">
      <Canvas
        camera={{ position: [5, 4, 8], fov: 50 }}
        dpr={[1, 1.25]}
        frameloop="demand"
        gl={{ antialias: false, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#09090b"]} />
        <ambientLight intensity={0.65} />
        <directionalLight intensity={1} position={[8, 12, 5]} />
        <directionalLight intensity={0.45} position={[-8, 6, -4]} />
        {showGrid ? <Grid args={[40, 40]} cellColor="#3f3f46" sectionColor="#52525b" /> : null}
        {showAxes ? <axesHelper args={[4]} /> : null}
        <OrbitControls ref={controlsRef} enableDamping={false} enabled={!walkMode} />
        <WalkController enabled={walkMode} />

        <Suspense fallback={null}>
          {currentAsset ? (
            <Model
              file={currentAsset.file}
              wireframe={wireframe}
              measureMode={measureMode}
              onPickPoint={onPickPoint}
              onReady={setModelObject}
              onError={onModelError}
              onLoadingChange={setLoading}
              onWarnings={setWarnings}
            />
          ) : null}
        </Suspense>
        {activeMeasurePoints.map((point, index) => (
          <mesh key={`${point.x}-${point.y}-${point.z}-${index}`} position={point}>
            <sphereGeometry args={[0.045, 16, 16]} />
            <meshBasicMaterial color="#22d3ee" />
            {measureAngles ? (
              <Html distanceFactor={12}>
                <div className="rounded bg-zinc-900/80 px-1.5 py-0.5 text-[10px] text-zinc-100">
                  {measureAngles[index].toFixed(1)} deg
                </div>
              </Html>
            ) : null}
          </mesh>
        ))}
        {activeMeasurePoints.length >= 2 ? (
          <Line points={[activeMeasurePoints[0], activeMeasurePoints[1]]} color="#22d3ee" lineWidth={1} />
        ) : null}
        {activeMeasurePoints.length >= 3 ? (
          <>
            <Line points={[activeMeasurePoints[1], activeMeasurePoints[2]]} color="#22d3ee" lineWidth={1} />
            <Line points={[activeMeasurePoints[2], activeMeasurePoints[0]]} color="#22d3ee" lineWidth={1} />
          </>
        ) : null}
        <CameraController model={modelObject} resetSignal={resetSignal} controlsRef={controlsRef} />
      </Canvas>

      {!currentAsset && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <p className="rounded-md border border-zinc-700 bg-zinc-900/80 px-4 py-2 text-sm text-zinc-300">
            Upload a 3D model to start previewing
          </p>
        </div>
      )}

      {loading && (
        <div className="pointer-events-none absolute right-3 top-3 rounded-md bg-zinc-900/90 px-3 py-1 text-xs text-zinc-200">
          Parsing model...
        </div>
      )}
      {walkMode ? (
        <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-zinc-900/90 px-3 py-1 text-xs text-zinc-200">
          Walk mode: click scene to lock pointer, move with W/A/S/D
        </div>
      ) : null}
      {measureMode ? (
        <div className="pointer-events-none absolute left-3 top-10 rounded-md bg-zinc-900/90 px-3 py-1 text-xs text-zinc-200">
          Measure mode: click 3 points on mesh
        </div>
      ) : null}

      {(localError || warningText) && (
        <div className="absolute bottom-3 left-3 right-3 space-y-2">
          {localError ? (
            <div className="rounded-md border border-red-700/80 bg-red-950/70 px-3 py-2 text-sm text-red-200">
              {localError}
            </div>
          ) : null}
          {warningText ? (
            <div className="rounded-md border border-amber-700/80 bg-amber-950/70 px-3 py-2 text-xs text-amber-200">
              {warningText}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
