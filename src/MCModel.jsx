import { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'

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

// テクスチャパス解決
function lookupTexturePath(path, textureMap) {
  if (!path) return null;
  if (textureMap[path]) return textureMap[path];
  const noMinecraft = path.replace('minecraft:', '');
  if (textureMap[noMinecraft]) return textureMap[noMinecraft];
  const onlyPath = noMinecraft.includes(':') ? noMinecraft.split(':')[1] : noMinecraft;
  if (textureMap[onlyPath]) return textureMap[onlyPath];
  const fileName = onlyPath.split('/').pop();
  if (textureMap[fileName]) return textureMap[fileName];
  return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
}

// #の変数を解決
function resolveTextureKey(texKey, textures) {
  let currentPath = textures[texKey] || texKey;
  let safety = 0;
  
  while (typeof currentPath === 'string' && currentPath.startsWith('#') && safety < 10) {
    const nextKey = currentPath.replace('#', '');
    currentPath = textures[nextKey] || nextKey;
    safety++;
  }
  return currentPath;
}

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
      
      console.log(`Face ${faceName}: texKey=${texKey}, finalPath=${finalPath}, url=${textureUrl?.substring(0, 50)}...`);
      
      const material = new THREE.MeshStandardMaterial({
        transparent: true,
        color: 0xffffff,
        roughness: 1.0,
        metalness: 0.0,
      });
      
      if (textureUrl) {
        const texture = loader.load(textureUrl, (tex) => {
          tex.magFilter = THREE.NearestFilter;
          tex.minFilter = THREE.NearestFilter;
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          tex.colorSpace = THREE.SRGBColorSpace;
          
          if (faceData.uv) {
            const u = faceData.uv[0] / 16;
            const v = 1 - faceData.uv[3] / 16;
            const w = (faceData.uv[2] - faceData.uv[0]) / 16;
            const h = (faceData.uv[3] - faceData.uv[1]) / 16;
            tex.offset.set(u, v);
            tex.repeat.set(w, h);
          }
          
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