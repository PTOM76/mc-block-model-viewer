/// <reference path="./vite-env.d.ts" />
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Center, OrthographicCamera } from '@react-three/drei'
import { useState, Suspense, useEffect, useRef } from 'react';
import { loadConfig } from './config';
import { t, setLang } from './i18n';
import * as THREE from 'three';

// @ts-ignore
import { MCModel } from './MCModel';

/**
 * エクスポート用の平行投影カメラを作成する
 */
function createExportCamera() {
  const size = 0.8;
  const camera = new THREE.OrthographicCamera(
    -size, size,  // left, right
    size, -size,  // top, bottom
    0.1, 100      // near, far
  );
  
  camera.position.set(-1, 0.825, -1); // minecraft.wiki の作業台のサイズがこれぐらいだった
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  return camera;
}

function PNGExporter({ onExport, format }: { onExport: (dataUrl: string) => void; format: 'png' | 'jpg' | 'gif' }) {
  const { gl, scene, camera } = useThree();
  
  useEffect(() => {
    (window as any).__exportPNG = (width = 300, height = 300, _format = format) => {
      const _renderer = new THREE.WebGLRenderer({ 
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

async function renderModelOffscreen(modelData: any, textureFiles: any, format: string, width = 300, height = 300): Promise<string> {
  const scene = new THREE.Scene();
  
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
  scene.add(ambientLight);
  const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.5);
  dirLight1.position.set(5, 10, 5);
  scene.add(dirLight1);
  const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
  dirLight2.position.set(-5, -5, -5);
  scene.add(dirLight2);
  const dirLight3 = new THREE.DirectionalLight(0xffffff, 0.3);
  dirLight3.position.set(0, -5, 0);
  scene.add(dirLight3);
  
  const modelGroup = await buildMCModelGroup(modelData, textureFiles);
  scene.add(modelGroup);
  
  const renderer = new THREE.WebGLRenderer({ 
    antialias: false, 
    alpha: true,
    preserveDrawingBuffer: true 
  });
  renderer.setSize(width, height);
  renderer.setClearColor(0x000000, 0);

  renderer.toneMapping = THREE.NoToneMapping;
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

function CameraResetter() {
  const { camera, controls } = useThree();
  
  useEffect(() => {
    (window as any).__resetCamera = () => {
      camera.position.set(-1, 0.825, -1);
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

const ResponsiveOrthoCamera: React.FC<{ position: [number, number, number]; near: number; far: number; zoom?: number }> = ({ position, near, far, zoom = 0.75 }) => {
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

function App() {
  const [data, setData] = useState<{models: any, textureFiles: any} | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [osPrefersDark, setOsPrefersDark] = useState(true);
  const [themeMode, setThemeMode] = useState<'system' | 'dark' | 'light'>('system');
  const [isBatchExporting, setIsBatchExporting] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);

  const defaultConfig = { cameraType: 'orthographic', near: 0.1, far: 100, light: 1 };
  const [config, setConfig] = useState<{ cameraType: string; near: number; far: number; light: number }>(defaultConfig);

  useEffect(() => {
    (async () => {
      const cfg = await loadConfig();
      setConfig(cfg || defaultConfig);
      if (cfg && cfg.lang) setLang(cfg.lang);
    })();
  }, []);

  useEffect(() => {
    if (!(window as any).ipcRenderer) return;
    const handler = (_event: any, newConfig: any) => {
      setConfig(newConfig);
      if (newConfig && newConfig.lang) setLang(newConfig.lang);
    };
    const unsub = (window as any).ipcRenderer.on('config-updated', handler);
    return () => { if (unsub) unsub(); };
  }, []);

  useEffect(() => {
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setOsPrefersDark(darkModeQuery.matches);
    
    const handleThemeChange = (e: MediaQueryListEvent) => {
      setOsPrefersDark(e.matches);
    };
    
    darkModeQuery.addEventListener('change', handleThemeChange);
    return () => darkModeQuery.removeEventListener('change', handleThemeChange);
  }, []);

  const isDark = themeMode === 'dark' || (themeMode === 'system' && osPrefersDark);

  useEffect(() => {
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // メニューからのテーマ変更を受け取る
  useEffect(() => {
    if (!(window as any).ipcRenderer) {
      console.error('ipcRenderer が見つかりません');
      return;
    }

    const handleSetTheme = (_event: any, mode: string) => {
      console.log('テーマ変更:', mode);
      setThemeMode(mode as 'system' | 'dark' | 'light');
    };

    const unsubscribe = (window as any).ipcRenderer.on('set-theme', handleSetTheme);

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

useEffect(() => {
    // メインプロセスのメニューから「jarを開く」が実行された時
    const removeListener = (window as any).ipcRenderer.on('mod-data-extracted', (_event: any, result: any) => {
      const merged = mergeData(data, result);
      setData(merged);
      if (!selectedModel || !merged.models[selectedModel]) {
        setSelectedModel(Object.keys(merged.models)[0]);
      }
    });

    return () => {
      // クリーンアップ（リスナーの重複登録を防ぐ）
      if (typeof removeListener === 'function') removeListener();
    };
  }, [data, selectedModel]);

  const mergeData = (existing: {models: any, textureFiles: any} | null, newData: {models: any, textureFiles: any}) => {
    if (!existing) return newData;
    return {
      models: { ...existing.models, ...newData.models },
      textureFiles: { ...existing.textureFiles, ...newData.textureFiles }
    };
  };

  const handlePickFile = async () => {
    const result = await window.ipcRenderer.invoke('extract-mod-data');
    if (result) {
      const merged = mergeData(data, result);
      setData(merged);
      // 最初のモデルをデフォルトで選択
      if (!selectedModel || !merged.models[selectedModel]) {
        const firstModel = Object.keys(merged.models)[0];
        setSelectedModel(firstModel);
      }
      console.log("Selected model:", selectedModel);
    }
  };

  const handleDownloadMinecraft = async () => {
    const result = await window.ipcRenderer.invoke('download-minecraft-jar');

    if (result) {
      const merged = mergeData(data, result);
      setData(merged);
      if (!selectedModel || !merged.models[selectedModel]) {
        const firstModel = Object.keys(merged.models)[0];
        setSelectedModel(firstModel);
      }
      console.log("Downloaded Minecraft data, selected model:", selectedModel);
    } else {
      alert(t('download_minecraft_jar') + t('save_cancel'));
    }
  };

  const handleClearData = () => {
    setData(null);
    setSelectedModel("");
  };

  const handleExportPNG = () => {
    if (!selectedModel) {
      alert(t('select_model_alert'));
      return;
    }
    
    if ((window as any).__exportPNG) {
      console.log('PNG出力開始:', selectedModel);
      (window as any).__exportPNG();
    } else {
      alert(t('canvas_not_ready'));
    }
  };

  const handlePNGData = async (dataUrl: string) => {
    // 単一画像出力、ファイルダイアログで保存
    const success = await window.ipcRenderer.invoke('save-png', dataUrl, selectedModel);
    if (success) {
      alert(t('save_png_complete'));
    } else {
      alert(t('save_cancel'));
    }
  };

  const handleResetCamera = () => {
    if ((window as any).__resetCamera) {
      (window as any).__resetCamera();
    }
  };

  // メニューから単一画像出力
  useEffect(() => {
    const handleExportSinglePNG = () => {
      if (!selectedModel) {
        alert(t('select_model_alert'));
        return;
      }
      handleExportPNG();
    };

    const unsubscribe = (window as any).ipcRenderer?.on('export-single-png', handleExportSinglePNG);
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [selectedModel]);

  // 詳細画像出力ダイアログからの受信
  useEffect(() => {
    const handleDetailDialogSubmit = async (_event: any, config: { format: string; width: number; height: number }) => {
      if (!selectedModel) {
        alert(t('select_model_alert'));
        return;
      }
      if ((window as any).__exportPNG) {
        (window as any).__exportPNG(config.width, config.height, config.format);
      } else {
        alert(t('canvas_not_ready'));
      }
    };
    const unsubscribe = (window as any).ipcRenderer?.on('detail-dialog-submit', handleDetailDialogSubmit);
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [selectedModel]);

  // バッチ出力ダイアログからの受信
  useEffect(() => {
    const handleBatchExportConfig = async (_event: any, config: { format: string; template: string; width: number; height: number }) => {
      if (!data || !data.models || Object.keys(data.models).length === 0) {
        alert(t('models_not_loaded'));
        return;
      }
      const outputDir = await (window as any).ipcRenderer?.invoke('select-batch-output-folder');
      if (!outputDir) return;
      const modelList = Object.keys(data.models);
      setIsBatchExporting(true);
      for (let i = 0; i < modelList.length; i++) {
        const modelName = modelList[i];
        const modelData = data.models[modelName];
        try {
          const dataUrl = await renderModelOffscreen(modelData, data.textureFiles, config.format, config.width, config.height);
          const [modid, ...rest] = modelName.split(':');
          const modelPath = rest.join(':');
          
          let cleanModelPath = modelPath.replace(/^(block_|item_)/, '');
          let fileName = config.template
            .replace('$1', modid || 'unknown')
            .replace('$2', cleanModelPath || 'unknown')
            .replace(/[/\\:*?"<>|]/g, '_');
          const ext = `.${config.format}`;
          if (!fileName.endsWith(ext)) {
            fileName = fileName.replace(/\.[^.]*$/, '') + ext;
          }
          await window.ipcRenderer.invoke('save-png-batch', { dataUrl, fileName, format: config.format });
          if ((i + 1) % 10 === 0) await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          console.error(`モデル ${modelName} の出力に失敗:`, error);
        }
      }
      setIsBatchExporting(false);
      setCanvasKey(prev => prev + 1);
      setTimeout(() => {
        alert(t('output_complete', { COUNT: modelList.length }));
      }, 300);
    };
    const unsubscribe = (window as any).ipcRenderer?.on('batch-dialog-submit', handleBatchExportConfig);
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [data]);

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', background: "var(--bg-color)" }}>

      {/* 左側のサイドリスト */}
      <div style={{ minWidth: '150px', width: '200px', borderRight: `1px solid ${"var(--border-color)"}`, padding: '10px', color: "var(--text-color)" }}>
        <button onClick={handlePickFile} className="sidebar-button">{t('open_jar')}</button>
        <button onClick={handleDownloadMinecraft} className="sidebar-button">{t('download_minecraft_jar')}</button>
        {data && selectedModel && (<>
        <button onClick={handleClearData} className="sidebar-button">{t('clear_all')}</button>
        <button onClick={handleExportPNG} className="sidebar-button last">{t('save_as_image')}</button>
        </>)}

        {/*モデルリスト */}
        <div style={{ overflowY: 'auto', height: 'calc(100vh - 149px)' }}>
          {data && data.models && Object.keys(data.models).map(name => (
            <div 
              key={name} 
              onClick={() => setSelectedModel(name)}
              style={{
                padding: '1px',
                fontSize: '14px',
                cursor: 'pointer',
                background: selectedModel === name ? "var(--selected-bg)" : 'transparent',
                color: "var(--text-color)"
              }}
            >
              {name.replace('block/', '')}
            </div>
          ))}
        </div>
      </div>

      {/* 右側：3Dプレビュー */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', width: '100%', height: '100%' }}>
        {/* バッチ出力中の表示 */}
        {isBatchExporting && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '20px 40px',
            borderRadius: '8px',
            zIndex: 100,
            fontSize: '18px'
          }}>
            {t('batch_exporting')}
          </div>
        )}
        
        {/* カメラ操作ボタン */}
        <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10, display: 'flex', gap: '5px' }}>
          <button 
            onClick={handleResetCamera} title={t('reset_camera_title')}
            style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: '4px' }}>
            {t('reset')}
          </button>
        </div>
        {config && (
          <Canvas 
            key={canvasKey}
            gl={{ 
              antialias: false,
              toneMapping: THREE.NoToneMapping,
              toneMappingExposure: 1.0
            }}
            style={{ width: '100%', height: '100%' }}
            resize={{ scroll: false, debounce: { scroll: 0, resize: 0 } }}
          >
            {/* カメラ方式切替 */}
            {config.cameraType === 'perspective' ? (
              <perspectiveCamera position={[-1, 0.825, -1]} near={config.near} far={config.far} zoom={0.75} />
            ) : (
              <ResponsiveOrthoCamera position={[-1, 0.825, -1]} near={config.near} far={config.far} zoom={0.75} />
            )}
            <ambientLight intensity={config.light ?? 1.0} />
            <directionalLight position={[5, 10, 5]} intensity={1.5} />
            <directionalLight position={[-5, -5, -5]} intensity={0.5} />
            <directionalLight position={[0, -5, 0]} intensity={0.3} />
            <Suspense fallback={null}>
              <Center>
                {data && selectedModel && (
                  <MCModel 
                    data={data.models[selectedModel]} 
                    textureMap={data.textureFiles} 
                  />
                )}
              </Center>
            </Suspense>
            <OrbitControls />
            <CameraResetter />
            <PNGExporter onExport={handlePNGData} format={"png"} />
          </Canvas>
        )}
      </div>
    </div>
  );
}

export default App