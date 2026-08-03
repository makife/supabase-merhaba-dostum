import { Component, ReactNode, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import * as THREE from "three";


/** 3D model yüklenemezse uygulamayı çökertmemesi için hata sınırı */
class SceneErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("[HomeIslandScene] 3D sahne yüklenemedi:", error);
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}


// Model Vite tarafından paketlenir (public'ten mime sorununu aşmak için)
import ISLAND_MODEL_URL from "@/assets/models/3dLakeLowPoly.fbx?url";

const LEFT_ARROW_URL = "/anaSayfa/anasayfaSolaOk.svg";
const RIGHT_ARROW_URL = "/anaSayfa/anasayfaSagOk.svg";


type RotationPhase = "idle" | "toBack" | "holding" | "toFront";

// Adanın diğer tarafına dönüp 5sn bekledikten sonra eski perspektife geri dönme süreleri (ms)
const ROTATE_DURATION = 900;
const HOLD_DURATION = 5000;

/** Yavaşça yukarı-aşağı salınan yüzen ada modeli */
function FloatingIsland() {
  const obj = useLoader(FBXLoader, ISLAND_MODEL_URL) as unknown as THREE.Group;
  const groupRef = useRef<THREE.Group>(null);

  // Modeli ortala ve kameraya sığacak şekilde ölçekle
  const model = useMemo(() => {
    const clone = obj.clone(true);
    // FBX'in kendi materyalleri/textureları korunur; sadece renk uzayı düzeltilir
    clone.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat) => {
        const m = mat as THREE.MeshPhongMaterial;
        if (m?.map) m.map.colorSpace = THREE.SRGBColorSpace;
        if (m) m.side = THREE.DoubleSide;
        m?.needsUpdate && (m.needsUpdate = true);
      });
    });

    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 4.5 / maxDim;
    clone.position.set(-center.x, -center.y, -center.z);
    const wrapper = new THREE.Group();
    wrapper.add(clone);
    wrapper.scale.setScalar(scale);
    return wrapper;
  }, [obj]);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(clock.getElapsedTime() * 0.6) * 0.18;
      groupRef.current.rotation.y += 0.0008;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={model} />
    </group>
  );
}


/** Kamerayı adanın etrafında yumuşakça döndürüp geri getiren rig */
function CameraRig({ phase, direction }: { phase: RotationPhase; direction: 1 | -1 }) {
  const angleRef = useRef(0);
  const radius = 6.5;
  const height = 3;

  useFrame((state) => {
    const targetAngle = phase === "toBack" || phase === "holding" ? direction * Math.PI : 0;
    angleRef.current += (targetAngle - angleRef.current) * 0.05;
    state.camera.position.x = Math.sin(angleRef.current) * radius;
    state.camera.position.z = Math.cos(angleRef.current) * radius;
    state.camera.position.y = height;
    state.camera.lookAt(0, 0, 0);
  });

  return null;
}

interface HomeIslandSceneProps {
  /** Sol ok tıklanıp dönüş animasyonu bittiğinde çağrılır (ör. profile git) */
  onFinishLeft: () => void;
  /** Sağ ok tıklanıp dönüş animasyonu bittiğinde çağrılır (ör. liderlik tablosuna git) */
  onFinishRight: () => void;
}

export function HomeIslandScene({ onFinishLeft, onFinishRight }: HomeIslandSceneProps) {
  const [phase, setPhase] = useState<RotationPhase>("idle");
  const [direction, setDirection] = useState<1 | -1>(1);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  };

  useEffect(() => clearTimers, []);

  const triggerRotate = useCallback(
    (dir: 1 | -1, onDone: () => void) => {
      if (phase !== "idle") return; // dönüş sürerken tekrar tetiklenmesin
      clearTimers();
      setDirection(dir);
      setPhase("toBack");

      timeoutsRef.current.push(
        setTimeout(() => {
          setPhase("holding");
          timeoutsRef.current.push(
            setTimeout(() => {
              setPhase("toFront");
              timeoutsRef.current.push(
                setTimeout(() => {
                  setPhase("idle");
                  onDone();
                }, ROTATE_DURATION),
              );
            }, HOLD_DURATION),
          );
        }, ROTATE_DURATION),
      );
    },
    [phase],
  );

  const isBusy = phase !== "idle";

  return (
    <div className="absolute inset-0">
      <Canvas camera={{ position: [0, 3, 6.5], fov: 45 }} dpr={[1, 2]}>
        {/* Mavi gökyüzü */}
        <color attach="background" args={["#4fa3e0"]} />
        <fog attach="fog" args={["#4fa3e0", 10, 22]} />
        <ambientLight intensity={0.95} />
        <directionalLight position={[5, 8, 5]} intensity={1.1} />
        <directionalLight position={[-5, 4, -4]} intensity={0.35} />

        <SceneErrorBoundary>
          <Suspense fallback={null}>
            <FloatingIsland />
          </Suspense>
        </SceneErrorBoundary>


        <CameraRig phase={phase} direction={direction} />
      </Canvas>

      {/* SOL OK */}
      <button
        type="button"
        aria-label="Profil"
        disabled={isBusy}
        onClick={() => triggerRotate(-1, onFinishLeft)}
        className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-12 h-12 flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40"
      >
        <img src={LEFT_ARROW_URL} alt="Sol" className="w-full h-full drop-shadow-lg select-none pointer-events-none" />
      </button>

      {/* SAĞ OK */}
      <button
        type="button"
        aria-label="Liderlik Tablosu"
        disabled={isBusy}
        onClick={() => triggerRotate(1, onFinishRight)}
        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-12 h-12 flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40"
      >
        <img src={RIGHT_ARROW_URL} alt="Sağ" className="w-full h-full drop-shadow-lg select-none pointer-events-none" />
      </button>
    </div>
  );
}

export default HomeIslandScene;
