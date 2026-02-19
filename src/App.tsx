/// <reference path="./vite-env.d.ts" />
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Center } from '@react-three/drei'
import { useState, Suspense, useEffect } from 'react';
import { loadConfig } from './config';
import { t, setLang } from './i18n';
import * as THREE from 'three';

// @ts-ignore
import { MCModel } from './MCModel';

import * as CameraUtil from './util/CameraUtil';
import { ResponsiveOrthoCamera } from './util/ResponsiveOrthoCamera';
import { ImageExporter, renderModelOffscreen } from './util/ImageExporter';

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

  const handleClearData = () => {
    setData(null);
    setSelectedModel("");
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

  const handleExportImage = () => {
    if (!selectedModel) {
      alert(t('select_model_alert'));
      return;
    }
    
    if ((window as any).__exportImage) {
      console.log('画像出力開始:', selectedModel);
      (window as any).__exportImage();
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
      handleExportImage();
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
      if ((window as any).__exportImage) {
        (window as any).__exportImage(config.width, config.height, config.format);
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

          console.log("modelName:" + modelName);
          const [modid, ...rest] = modelName.split(':');
          const modelPath = rest.join(':');
          
          let cleanModelPath = modelPath.replace(/^(block\/)/, '');
          console.log("cleanModelPath:" + cleanModelPath);
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
        <button onClick={handleExportImage} className="sidebar-button last">{t('save_as_image')}</button>
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
            <CameraUtil.CameraResetter />
            <ImageExporter onExport={handlePNGData} format={"png"} />
          </Canvas>
        )}
      </div>
    </div>
  );
}

export default App