import { useMemo, useRef, useEffect } from 'react'

import * as THREE from 'three'
import { lookupTexturePath, resolveTextureKey, resolveUV, getFaceUVs } from './util/MCModelBuilder';

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
          tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
          tex.colorSpace = THREE.SRGBColorSpace;

          material.map = tex;
          material.needsUpdate = true;
        });
      }

      return material;
    });
  }, [element, textures, textureMap]);

  // BoxGeometryの作成とUVの適用
  const geometry = useMemo(() => {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const uvAttribute = geo.attributes.uv;

    facesOrder.forEach((faceName, index) => {
      const faceData = element.faces[faceName];
      // index * 8 が該当面のUV配列の開始位置
      const baseIdx = index * 8;
      
      if (faceData) {
        const uvs = getFaceUVs(resolveUV(faceData.uv), faceData.rotation || 0);
        for (let i = 0; i < 8; i++) {
          uvAttribute.array[baseIdx + i] = uvs[i];
        }
      } else {
        // 面が存在しない場合はUVを潰しておくなどの対応も可能
      }
    });

    uvAttribute.needsUpdate = true;
    return geo;
  }, [width, height, depth, element]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      materials.forEach(mat => {
        if (mat.map) mat.map.dispose();
        mat.dispose();
      });
      geometry.dispose();
    };
  }, [materials, geometry]);

  return (
    <mesh ref={meshRef} position={position} rotation={rotation} geometry={geometry} material={materials}>
    </mesh>
  );
}