import { useMemo, useRef, useEffect } from 'react'

import * as THREE from 'three'
import { lookupTexturePath, resolveTextureKey, resolveUV, getTextureTransform } from './util/MCModelBuilder';

const VANILLA_CUBE_ELEMENTS = [
  {
    from: [0, 0, 0],
    to: [16, 16, 16],
    faces: {
      down:  { uv: [0, 0, 16, 16], texture: "#down" },
      up:    { uv: [0, 0, 16, 16], texture: "#up" },
      north: { uv: [0, 0, 16, 16], texture: "#north" },
      south: { uv: [0, 0, 16, 16], texture: "#south" },
      west:  { uv: [0, 0, 16, 16], texture: "#west" },
      east:  { uv: [0, 0, 16, 16], texture: "#east" }
    }
  }
];



export function MCModel({ data, textureMap }) {
  if (!data) return null;

  const elements = data.elements || VANILLA_CUBE_ELEMENTS;
  const textures = data.textures || {};

  return (
    <group>
      {elements.map((element, index) => (
        <MCElement 
          key={index} 
          element={element} 
          textureMap={textureMap} 
          textures={textures}
        />
      ))}
    </group>
  );
}

function MCElement({ element, textureMap, textures }) {
  const meshRef = useRef();
  
  const width = (element.to[0] - element.from[0]) / 16;
  const height = (element.to[1] - element.from[1]) / 16;
  const depth = (element.to[2] - element.from[2]) / 16;

  const position = [
    (element.from[0] + (element.to[0] - element.from[0]) / 2 - 8) / 16,
    (element.from[1] + (element.to[1] - element.from[1]) / 2 - 8) / 16,
    (element.from[2] + (element.to[2] - element.from[2]) / 2 - 8) / 16
  ];

  const rotation = element.rotation ? [
    element.rotation.axis === 'x' ? THREE.MathUtils.degToRad(element.rotation.angle) : 0,
    element.rotation.axis === 'y' ? THREE.MathUtils.degToRad(element.rotation.angle) : 0,
    element.rotation.axis === 'z' ? THREE.MathUtils.degToRad(element.rotation.angle) : 0,
  ] : [0, 0, 0];

  // BoxGeometryの面順序は +X, -X, +Y, -Y, +Z, -Z
  // つまり、east, west, up, down, south, north
  const facesOrder = ['east', 'west', 'up', 'down', 'south', 'north'];

  // 各面のマテリアルを作成
  const materials = useMemo(() => {
    const loader = new THREE.TextureLoader();
    return facesOrder.map((faceName) => {
      const faceData = element.faces[faceName];
      if (!faceData) {
        return new THREE.MeshStandardMaterial({ transparent: true, opacity: 0 });
      }

      const texKey = faceData.texture.replace('#', '');
      const finalPath = resolveTextureKey(texKey, textures);
      const textureUrl = lookupTexturePath(finalPath, textureMap);

      // console.log(`Face ${faceName}: texKey=${texKey}, finalPath=${finalPath}, url=${textureUrl?.substring(0, 50)}...`);

      const material = new THREE.MeshStandardMaterial({
        transparent: true,
        color: 0xffffff,
        roughness: 1.0,
        metalness: 0.0,
      });

      if (textureUrl) {
        loader.load(textureUrl, (tex) => {
          tex.magFilter = THREE.NearestFilter;
          tex.minFilter = THREE.NearestFilter;
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          tex.colorSpace = THREE.SRGBColorSpace;

          const uv = resolveUV(faceData.uv);
          const { repeat, offset } = getTextureTransform(uv);
          tex.offset.set(offset.x, offset.y);
          tex.repeat.set(repeat.x, repeat.y);

          material.map = tex;
          material.needsUpdate = true;
        });
      }

      return material;
    });
  }, [element, textures, textureMap]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      materials.forEach(mat => {
        if (mat.map) mat.map.dispose();
        mat.dispose();
      });
    };
  }, [materials]);

  return (
    <mesh ref={meshRef} position={position} rotation={rotation} material={materials}>
      <boxGeometry args={[width, height, depth]} />
    </mesh>
  );
}