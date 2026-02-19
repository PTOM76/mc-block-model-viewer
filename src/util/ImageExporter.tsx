import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { AmbientLight, DirectionalLight, NoToneMapping, OrthographicCamera, Scene, WebGLRenderer } from "three";
import * as THREE from 'three';

/**
 * エクスポート用の平行投影カメラを作成する
 */
export function createExportCamera() {
  const size = 0.8;
  const camera = new OrthographicCamera(
    -size, size,  // left, right
    size, -size,  // top, bottom
    0.1, 100      // near, far
  );
  
  camera.position.set(-1, 0.825, -1); // minecraft.wiki の作業台のサイズがこれぐらいだった
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  return camera;
}

export function ImageExporter({ onExport, format }: { onExport: (dataUrl: string) => void; format: 'png' | 'jpg' | 'gif' }) {
  const { gl, scene, camera } = useThree();
  
  useEffect(() => {
    (window as any).__exportImage = (width = 300, height = 300, _format = format) => {
      const _renderer = new WebGLRenderer({ 
        antialias: false, 
        alpha: true,
        preserveDrawingBuffer: true 
      });
      _renderer.setSize(width, height);
      _renderer.setClearColor(0x000000, 0); // 透明背景
      
      const _camera = createExportCamera();

      _renderer.render(scene, _camera);
      let mimeType: string;
      let quality = 0.95;
      
      switch (_format) {
        case 'jpg':
          mimeType = 'image/jpeg';
          break;
        case 'gif':
          mimeType = 'image/gif';
          break;
        default:
          mimeType = 'image/png';
      }
      
      const dataUrl = _renderer.domElement.toDataURL(mimeType, quality);
      
      // クリーンアップ
      _renderer.dispose();
      
      onExport(dataUrl);
    };
  }, [gl, scene, camera, onExport, format]);
  
  return null;
}

export async function renderModelOffscreen(modelData: any, textureFiles: any, format: string, width = 300, height = 300): Promise<string> {
  const scene = new Scene();
  
  const ambientLight = new AmbientLight(0xffffff, 1.0);
  scene.add(ambientLight);
  const dirLight1 = new DirectionalLight(0xffffff, 1.5);
  dirLight1.position.set(5, 10, 5);
  scene.add(dirLight1);
  const dirLight2 = new DirectionalLight(0xffffff, 0.5);
  dirLight2.position.set(-5, -5, -5);
  scene.add(dirLight2);
  const dirLight3 = new DirectionalLight(0xffffff, 0.3);
  dirLight3.position.set(0, -5, 0);
  scene.add(dirLight3);
  
  const modelGroup = await buildMCModelGroup(modelData, textureFiles);
  scene.add(modelGroup);
  
  const renderer = new WebGLRenderer({ 
    antialias: false, 
    alpha: true,
    preserveDrawingBuffer: true 
  });
  renderer.setSize(width, height);
  renderer.setClearColor(0x000000, 0);

  renderer.toneMapping = NoToneMapping;
  renderer.toneMappingExposure = 1.0;
  
  const camera = createExportCamera();

  renderer.render(scene, camera);
  let mimeType: string;
  let quality = 0.95;
  
  switch (format) {
    case 'jpg':
      mimeType = 'image/jpeg';
      break;
    case 'gif':
      mimeType = 'image/gif';
      break;
    default:
      mimeType = 'image/png';
  }
  
  const dataUrl = renderer.domElement.toDataURL(mimeType, quality);
  
  // マテリアルとテクスチャをクリーンアップ
  scene.traverse((obj) => {
    if ((obj as any).geometry) (obj as any).geometry.dispose();
    if ((obj as any).material) {
      if (Array.isArray((obj as any).material)) {
        (obj as any).material.forEach((mat: any) => {
          if (mat.map) mat.map.dispose();
          mat.dispose();
        });
      } else {
        if ((obj as any).material.map) (obj as any).material.map.dispose();
        (obj as any).material.dispose();
      }
    }
  });
  
  // クリーンアップ
  renderer.dispose();
  renderer.forceContextLoss();
  
  // DOMからcanvas要素を削除
  if (renderer.domElement.parentNode)
    renderer.domElement.parentNode.removeChild(renderer.domElement);
  
  return dataUrl;
}

// MCModelをThree.jsグループとして構築する関数
async function buildMCModelGroup(modelData: any, textureFiles: any): Promise<THREE.Group> {
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
  
  const elements = modelData.elements || VANILLA_CUBE_ELEMENTS;
  const textures = modelData.textures || {};
  const group = new THREE.Group();
  
  const lookupTexturePath = (path: string) => {
    if (!path) return null;
    if (textureFiles[path]) return textureFiles[path];
    const noMinecraft = path.replace('minecraft:', '');
    if (textureFiles[noMinecraft]) return textureFiles[noMinecraft];
    const onlyPath = noMinecraft.includes(':') ? noMinecraft.split(':')[1] : noMinecraft;
    if (textureFiles[onlyPath]) return textureFiles[onlyPath];
    const fileName = onlyPath.split('/').pop() || '';
    if (textureFiles[fileName]) return textureFiles[fileName];
    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  };
  
  const resolveTextureKey = (texKey: string): string => {
    let currentPath = textures[texKey] || texKey;
    let safety = 0;
    while (typeof currentPath === 'string' && currentPath.startsWith('#') && safety < 10) {
      const nextKey = currentPath.replace('#', '');
      currentPath = textures[nextKey] || nextKey;
      safety++;
    }
    return currentPath;
  };
  
  const loader = new THREE.TextureLoader();
  const facesOrder = ['east', 'west', 'up', 'down', 'south', 'north'];
  
  // 全要素を処理（テクスチャロード完了を待つ）
  for (const element of elements) {
    const width = (element.to[0] - element.from[0]) / 16;
    const height = (element.to[1] - element.from[1]) / 16;
    const depth = (element.to[2] - element.from[2]) / 16;
    
    const position = [
      (element.from[0] + (element.to[0] - element.from[0]) / 2 - 8) / 16,
      (element.from[1] + (element.to[1] - element.from[1]) / 2 - 8) / 16,
      (element.from[2] + (element.to[2] - element.from[2]) / 2 - 8) / 16
    ];
    
    // 各面のテクスチャロードを並列実行
    const materialPromises = facesOrder.map((faceName) => {
      return new Promise<THREE.MeshStandardMaterial>((resolve) => {
        const faceData = element.faces[faceName];
        if (!faceData) {
          resolve(new THREE.MeshStandardMaterial({ transparent: true, opacity: 0 }));
          return;
        }
        
        const texKey = faceData.texture.replace('#', '');
        const resolvedPath = resolveTextureKey(texKey);
        const actualPath = lookupTexturePath(resolvedPath);
        
        loader.load(
          actualPath,
          (texture) => {
            texture.magFilter = THREE.NearestFilter;
            texture.minFilter = THREE.NearestFilter;
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            texture.colorSpace = THREE.SRGBColorSpace;
            
            const uv = faceData.uv || [0, 0, 16, 16];
            texture.repeat.set((uv[2] - uv[0]) / 16, (uv[3] - uv[1]) / 16);
            texture.offset.set(uv[0] / 16, 1 - uv[3] / 16);
            
            resolve(new THREE.MeshStandardMaterial({ 
              map: texture, 
              transparent: true,
              color: 0xffffff,
              roughness: 1.0,
              metalness: 0.0
            }));
          },
          undefined,
          (error) => {
            console.error('テクスチャロードエラー:', error);
            resolve(new THREE.MeshStandardMaterial({ transparent: true, opacity: 0 }));
          }
        );
      });
    });
    
    const materials = await Promise.all(materialPromises);
    
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geometry, materials);
    mesh.position.set(position[0], position[1], position[2]);
    
    if (element.rotation) {
      const axis = element.rotation.axis;
      const angle = THREE.MathUtils.degToRad(element.rotation.angle);
      if (axis === 'x') mesh.rotation.x = angle;
      if (axis === 'y') mesh.rotation.y = angle;
      if (axis === 'z') mesh.rotation.z = angle;
    }
    
    group.add(mesh);
  }
  
  return group;
}