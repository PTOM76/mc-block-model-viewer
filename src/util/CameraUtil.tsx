import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

export function CameraResetter() {
  const { camera, controls } = useThree();
  
  useEffect(() => {
    (window as any).__resetCamera = () => {
      camera.position.set(-1, 0.82, -1);
      camera.lookAt(0, 0, 0);
      camera.zoom = 0.75;
      camera.updateProjectionMatrix();
      if (controls) {
        (controls as any).target.set(0, 0, 0);
        (controls as any).update();
      }
    };
  }, [camera, controls]);
  
  return null;
}