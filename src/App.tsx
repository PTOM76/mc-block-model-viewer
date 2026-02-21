/// <reference path="./vite-env.d.ts" />
import { useState, useEffect } from 'react';
import { loadConfig } from './config';
import { t, setLang } from './i18n';
import { renderModelOffscreen } from './util/ImageExporter';
import SideBar from './parts/Sidebar';
import CameraControlPanel from './parts/CameraConrtolPanel';
import ExportingMessageOverlay from './parts/ExportingMessageOverlay';
import Preview from './parts/Preview';
import { useTheme } from './hooks/useTheme';

const App = () => {
    const [data, setData] = useState<{models: any, textureFiles: any} | null>(null);
    const [selectedModel, setSelectedModel] = useState<string>("");
    const [themeMode, setThemeMode] = useState<'system' | 'dark' | 'light'>('system');
    const [isBatchExporting, setIsBatchExporting] = useState(false);
    const [canvasKey, setCanvasKey] = useState(0);

    const defaultConfig = { cameraType: 'orthographic', near: 0.1, far: 100, light: 1 };
    const [config, setConfig] = useState<{ cameraType: string; near: number; far: number; light: number }>(defaultConfig);

    useTheme(themeMode, setThemeMode);

    useEffect(() => {
        const applyConfig = (config: any) => {
            setConfig(config || defaultConfig);
            if (config?.lang) setLang(config.lang);
        };

        (async () => {
            const config = await loadConfig();
            applyConfig(config);
        })();

        window.ipcRenderer?.on('config-updated', (_e: any, newConfig: any) => applyConfig(newConfig));

        // メインプロセスのメニューから「jarを開く」が実行された時
        window.ipcRenderer?.on('mod-data-extracted', (_e: any, res: any) => {
            const merged = mergeData(data, res);
            setData(merged);

            const firstModel = Object.keys(merged.models)[0];
            setSelectedModel(selectedModel && merged.models[selectedModel] ? selectedModel : firstModel);
        });
    }, []);

    const mergeData = (existing: {models: any, textureFiles: any} | null, newData: {models: any, textureFiles: any}) => {
        if (!existing) return newData;
        return {
            models: { ...existing.models, ...newData.models },
            textureFiles: { ...existing.textureFiles, ...newData.textureFiles }
        };
    };

    const handleImageData = async (dataUrl: string) => {
        // 単一画像出力、ファイルダイアログで保存
        const isSuccess = await window.ipcRenderer.invoke('save-image', dataUrl, selectedModel);
        if (isSuccess) {
            alert(t('save_png_complete'));
        } else {
            alert(t('save_cancel'));
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

    // 画像出力ダイアログからの受信
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
                    await window.ipcRenderer.invoke('save-image-batch', { dataUrl, fileName, format: config.format });
                    if ((i + 1) % 10 === 0) 
                        await new Promise(resolve => setTimeout(resolve, 50));
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

    // クリップボードに画像出力
    useEffect(() => {
        const handleExportImageToClipboard = () => {
            if (!selectedModel) {
                alert(t('select_model_alert'));
                return;
            }
            if ((window as any).__exportImage) {
                (window as any).__exportImage(undefined, undefined, 'png', async (dataUrl: string) => {
                    await window.ipcRenderer.invoke('copy-image-to-clipboard', dataUrl);
                });
            } else {
                alert(t('canvas_not_ready'));
            }
        };
        const unsubscribe = (window as any).ipcRenderer?.on('export-image-to-clipboard', handleExportImageToClipboard);
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [selectedModel]);

    return (
        <div style={{ width: '100%', height: '100vh', display: 'flex', background: "var(--bg-color)" }}>
            {/* 左側のサイドバー */}
            <SideBar data={data} setData={setData} selectedModel={selectedModel} setSelectedModel={setSelectedModel} handleExportImage={handleExportImage} mergeData={mergeData} t={t} />

            {/* 右側：3Dプレビュー */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', width: '100%', height: '100%' }}>
                {/* バッチ出力中の表示 */}
                {isBatchExporting && (
                    <ExportingMessageOverlay msg={t('batch_exporting')} />
                )}
            
                {/* カメラ操作ボタン */}
                <CameraControlPanel data={data} selectedModel={selectedModel} t={t} />

                {/* プレビュー */}
                {config && (
                    <Preview data={data} selectedModel={selectedModel} config={config} canvasKey={canvasKey} handleImageData={handleImageData}/>
                )}
            </div>
        </div>
    );
};

export default App;
