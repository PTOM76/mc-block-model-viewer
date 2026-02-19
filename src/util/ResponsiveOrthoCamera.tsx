import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import  { FC, useRef } from 'react';

export const ResponsiveOrthoCamera: FC<{ position: [number, number, number]; near: number; far: number; zoom?: number }> = ({ position, near, far, zoom = 0.75 }) => {
  const cameraRef = useRef<THREE.OrthographicCamera>(null);

  useFrame(({ camera, gl }) => {
    const cam = cameraRef.current || camera as THREE.OrthographicCamera;

    const width = gl.domElement.clientWidth;
    const height = gl.domElement.clientHeight;
    if (width === 0 || height === 0) return;

    const aspect = width / height;

    const frustumHeight = 2;
    const frustumWidth = frustumHeight * aspect;

    cam.left = -frustumWidth / 2;
    cam.right = frustumWidth / 2;
    cam.top = frustumHeight / 2;
    cam.bottom = -frustumHeight / 2;
    cam.updateProjectionMatrix();
  });

  return (
    <OrthographicCamera
      makeDefault
      position={position}
      near={near}
      far={far}
      zoom={zoom}
    />
  );
};