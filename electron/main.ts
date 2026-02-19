import { ipcMain as _ipcMain } from 'electron';
import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import AdmZip from 'adm-zip';
import fs from 'fs';
import https from 'node:https';

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

ipcMain.on('get-user-data-path', (event) => {
  event.returnValue = app.getPath('userData');
});

// config.jsonを返すIPCハンドラ
ipcMain.handle('get-config', async () => {
  const saveDir = path.join(app.getPath('userData'), 'data');
  const configPath = path.join(saveDir, 'config.json');
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    // ignore
  }
  return { cameraType: 'orthographic', near: 0.1, far: 100, light: 1 };
});

let win: BrowserWindow | null
let batchOutputDir: string | null = null
let detailDialogWin: BrowserWindow | null = null
let batchDialogWin: BrowserWindow | null = null
let configDialogWin: BrowserWindow | null = null

function createWindow() {
  win = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 400,
    minHeight: 300,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    icon: path.join(process.env.VITE_PUBLIC, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

function createDetailExportDialog() {
  if (detailDialogWin && !detailDialogWin.isDestroyed()) {
    detailDialogWin.focus();
    return;
  }

  detailDialogWin = new BrowserWindow({
    width: 300,
    height: 240,
    parent: win || undefined,
    modal: false,
    show: false,
    resizable: true,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  detailDialogWin.setMenu(null);
  if (VITE_DEV_SERVER_URL) {
    detailDialogWin.loadURL(`${VITE_DEV_SERVER_URL}detail-dialog.html`);
  } else {
    detailDialogWin.loadFile(path.join(app.getAppPath(), 'dist/detail-dialog.html'));
  }
  detailDialogWin.once('ready-to-show', () => {
    detailDialogWin?.show();
  });
  detailDialogWin.on('closed', () => {
    detailDialogWin = null;
  });
}

function createBatchExportDialog() {
  if (batchDialogWin && !batchDialogWin.isDestroyed()) {
    batchDialogWin.focus();
    return;
  }

  batchDialogWin = new BrowserWindow({
    width: 350,
    height: 300,
    parent: win || undefined,
    modal: false,
    show: false,
    resizable: true,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  batchDialogWin.setMenu(null);

  if (VITE_DEV_SERVER_URL) {
    batchDialogWin.loadURL(`${VITE_DEV_SERVER_URL}batch-dialog.html`);
  } else {
    batchDialogWin.loadFile(path.join(app.getAppPath(), 'dist/batch-dialog.html'));
  }
  
  batchDialogWin.once('ready-to-show', () => {
    batchDialogWin?.show();
  });

  batchDialogWin.on('closed', () => {
    batchDialogWin = null;
  });
}

function createConfigDialog() {
  if (configDialogWin && !configDialogWin.isDestroyed()) {
    configDialogWin.focus();
    return;
  }
  configDialogWin = new BrowserWindow({
    width: 300,
    height: 600,
    parent: win || undefined,
    modal: false,
    show: false,
    resizable: true,
    minimizable: true,
    maximizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  configDialogWin.setMenu(null);
  if (VITE_DEV_SERVER_URL) {
    configDialogWin.loadURL(`${VITE_DEV_SERVER_URL}config-dialog.html`);
  } else {
    configDialogWin.loadFile(path.join(app.getAppPath(), 'dist/config-dialog.html'));
  }
  configDialogWin.once('ready-to-show', () => {
    configDialogWin?.show();
  });
  configDialogWin.on('closed', () => {
    configDialogWin = null;
  });
}

async function processJarImport() {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Minecraft Mod', extensions: ['jar'] }]
  });

  if (canceled || filePaths.length === 0) return null;

  const allRawModels: Record<string, any> = {};
  const allTextureFiles: Record<string, string> = {};

  for (const filePath of filePaths) {
    const zip = new AdmZip(filePath);
    const zipEntries = zip.getEntries();

    zipEntries.forEach((entry) => {
      const name = entry.entryName;
      // テクスチャ抽出
      if (name.startsWith('assets/') && name.endsWith('.png')) {
        const parts = name.split('/');
        const modId = parts[1];
        const texPath = parts.slice(3).join('/').replace('.png', '');
        const base64 = `data:image/png;base64,${entry.getData().toString('base64')}`;
        if (!allTextureFiles[`${modId}:${texPath}`]) allTextureFiles[`${modId}:${texPath}`] = base64;
        if (!allTextureFiles[texPath]) allTextureFiles[texPath] = base64;
        if (!allTextureFiles[path.basename(name, '.png')]) allTextureFiles[path.basename(name, '.png')] = base64;
      }
      // モデル抽出
      if (name.startsWith('assets/') && name.includes('models/block/') && name.endsWith('.json')) {
        const parts = name.split('/');
        const modId = parts[1];
        const modelPath = parts.slice(3).join('/').replace('.json', '');
        const modelName = `${modId}:${modelPath}`;
        if (!allRawModels[modelName]) allRawModels[modelName] = JSON.parse(entry.getData().toString('utf8'));
      }
    });
  }

  const finalModels: Record<string, any> = {};
  Object.keys(allRawModels).forEach(name => {
    finalModels[name] = resolveFullModel(name, allRawModels);
  });

  return { models: finalModels, textureFiles: allTextureFiles };
}

ipcMain.handle('extract-mod-data', async () => {
  return await processJarImport();
});

const menubar: any = [
  {
    label: 'ファイル',
    submenu: [
      { label: 'jarを開く...', accelerator: 'CmdOrCtrl+O', click: async () => {
          const result = await processJarImport();
          if (result && win) {
            win.webContents.send('mod-data-extracted', result);
          }
      }},
      { type: 'separator' },
      { label: 'とりあえず、画像出力', accelerator: 'CmdOrCtrl+Shift+E', click: () => {
        if (win) win.webContents.send('export-single-png');
      }},
      { label: '画像出力...', click: () => {
        createDetailExportDialog();
      }},
      { label: '一括画像出力...', click: () => {
        createBatchExportDialog();
      }},
      { type: 'separator' },
      { label: '設定', click: () => {
        createConfigDialog();
      }},
      { type: 'separator' },
      { label: '終了', role: 'quit' }
    ]
  },
  {
    label: '編集',
    submenu: [
      { label: '元に戻す', role: 'undo' },
      { label: 'やり直し', role: 'redo' },
      { type: 'separator' },
      { label: '切り取り', role: 'cut' },
      { label: 'コピー', role: 'copy' },
      { label: '貼り付け', role: 'paste' }
    ]
  },
  {
    label: '表示',
    submenu: [
      { label: '再読み込み', role: 'reload' },
      { label: '開発者ツール', role: 'toggleDevTools' },
      { type: 'separator' },
      { label: 'ダークテーマ', click: () => {
          if (win) win.webContents.send('set-theme', 'dark');
      }},
      { label: 'ライトテーマ', click: () => {
          if (win) win.webContents.send('set-theme', 'light');
      }},
      { label: 'システム設定に従う', click: () => {
          if (win) win.webContents.send('set-theme', 'system');
      }},
      { type: 'separator' },
      { label: '拡大', role: 'zoomIn' },
      { label: '縮小', role: 'zoomOut' },
      { label: 'リセット', role: 'resetZoom' }
    ]
  },
  {
    label: 'ウィンドウ',
    submenu: [
      { label: '最小化', role: 'minimize' },
      { label: '閉じる', role: 'close' }
    ]
  },
  {
    label: 'ヘルプ',
    submenu: [
      { label: 'Block Model Viewr について', click: () => {
        dialog.showMessageBox({
          type: 'info',
          title: 'Block Model Viewer について',
          message: 'Block Model Viewer\nバージョン: 0.0.2\n作者: Pitan',
        });
      }},
      {
        label: 'GitHubリポジトリを開く',
        click: () => {
          shell.openExternal('https://github.com/PTOM76/mc-block-model-viewer');
        }
      }
    ]
  }
];

const menu = Menu.buildFromTemplate(menubar);
Menu.setApplicationMenu(menu);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)

let VANILLA_MODELS: Record<string, any> = {
  "block/cube": {
    "elements": [{
      "from": [0, 0, 0], "to": [16, 16, 16],
      "faces": {
        "down":  { "uv": [0, 0, 16, 16], "texture": "#down", "cullface": "down" },
        "up":    { "uv": [0, 0, 16, 16], "texture": "#up", "cullface": "up" },
        "north": { "uv": [0, 0, 16, 16], "texture": "#north", "cullface": "north" },
        "south": { "uv": [0, 0, 16, 16], "texture": "#south", "cullface": "south" },
        "west":  { "uv": [0, 0, 16, 16], "texture": "#west", "cullface": "west" },
        "east":  { "uv": [0, 0, 16, 16], "texture": "#east", "cullface": "east" }
      }
    }]
  },
  "block/cube_all": { "parent": "block/cube", "textures": { "particle": "#all", "down": "#all", "up": "#all", "north": "#all", "east": "#all", "south": "#all", "west": "#all" } },
  "block/cube_column": { "parent": "block/cube", "textures": { "particle": "#side", "down": "#end", "up": "#end", "north": "#side", "east": "#side", "south": "#side", "west": "#side" } },
  "block/cross": {
    "elements": [
      { "from": [0.8, 0, 8], "to": [15.2, 16, 8], "rotation": { "origin": [8, 8, 8], "axis": "y", "angle": 45, "rescale": true }, "faces": { "south": { "uv": [0, 0, 16, 16], "texture": "#cross" }, "north": { "uv": [0, 0, 16, 16], "texture": "#cross" } } },
      { "from": [8, 0, 0.8], "to": [8, 16, 15.2], "rotation": { "origin": [8, 8, 8], "axis": "y", "angle": 45, "rescale": true }, "faces": { "west": { "uv": [0, 0, 16, 16], "texture": "#cross" }, "east": { "uv": [0, 0, 16, 16], "texture": "#cross" } } }
    ]
  }
};

function resolveFullModel(modelName: string, modModels: Record<string, any>, visited = new Set<string>()): any {
  const cleanName = modelName.replace('minecraft:', '');
  
  if (visited.has(cleanName)) return null;
  visited.add(cleanName);

  const model = modModels[cleanName] || VANILLA_MODELS[cleanName];
  if (!model) return null;
  if (!model.parent) return model;

  const parentModel = resolveFullModel(model.parent, modModels, visited);
  if (!parentModel) return model;

  const mergedTextures = { ...(parentModel.textures || {}), ...(model.textures || {}) };
  
  return {
    ...parentModel,
    ...model,
    elements: model.elements || parentModel.elements,
    textures: mergedTextures
  };
}

ipcMain.handle('save-png', async (_event, dataUrl: string, modelName: string) => {
  try {
    const mimeMatch = dataUrl.match(/^data:image\/([^;]+);base64,/)
    const detectedFormat = mimeMatch ? mimeMatch[1] : 'png';
    const extension = detectedFormat === 'jpeg' ? 'jpg' : detectedFormat;
    
    const { filePath, canceled } = await dialog.showSaveDialog({
      defaultPath: `${modelName.replace(/[/:*?"<>|]/g, '_')}.${extension}`,
      filters: [
        { name: 'PNG画像', extensions: ['png'] },
        { name: 'JPEG画像', extensions: ['jpg', 'jpeg'] },
        { name: 'GIF画像', extensions: ['gif'] },
        { name: 'すべてのファイル', extensions: ['*'] }
      ]
    });
    
    if (canceled || !filePath) {
      return false;
    }
    
    // base64をBufferに変換して保存
    const base64Data = dataUrl.replace(/^data:image\/[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);
    
    console.log(`Image saved: ${filePath}`);
    return true;
  } catch (error) {
    console.error('Image save error:', error);
    return false;
  }
});

ipcMain.on('batch-dialog-submit', (_event, data: { format: string; template: string; width?: number; height?: number }) => {
  if (win && !win.isDestroyed())
    win.webContents.send('batch-dialog-submit', data);
  if (batchDialogWin && !batchDialogWin.isDestroyed())
    batchDialogWin.close();
});

ipcMain.on('detail-dialog-submit', (_event, data: { format: string; width?: number; height?: number }) => {
  if (win && !win.isDestroyed())
    win.webContents.send('detail-dialog-submit', data);
  if (detailDialogWin && !detailDialogWin.isDestroyed())
    detailDialogWin.close();
});

ipcMain.on('detail-dialog-cancel', () => {
  if (detailDialogWin && !detailDialogWin.isDestroyed())
    detailDialogWin.close();
});

ipcMain.on('batch-dialog-cancel', () => {
  if (batchDialogWin && !batchDialogWin.isDestroyed())
    batchDialogWin.close();
});

ipcMain.handle('select-batch-output-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
    properties: ['openDirectory'],
    title: '出力先フォルダを選択してください'
  });
  
  if (canceled || !filePaths || filePaths.length === 0) return null;
  
  batchOutputDir = filePaths[0];
  console.log('一括出力フォルダ選択:', batchOutputDir);
  return batchOutputDir;
});

ipcMain.handle('save-png-batch', async (_event, { dataUrl, fileName, format }: { dataUrl: string; fileName: string; format?: string }) => {
  try {
    if (!batchOutputDir) {
      console.error('batchOutputDir が設定されていません');
      return false;
    }

    let base64Data: string;
    if (dataUrl.startsWith('data:image/jpeg')) {
      base64Data = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
    } else if (dataUrl.startsWith('data:image/png')) {
      base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    } else {
      base64Data = dataUrl.replace(/^data:image\/[^;]+;base64,/, '');
    }
    
    const buffer = Buffer.from(base64Data, 'base64');
    const filePath = path.join(batchOutputDir, fileName);
    
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, buffer);
    console.log(`Image batch saved: ${filePath} (${format || 'png'})`);
    return true;
  } catch (error) {
    console.error('Image batch save error:', error);
    return false;
  }
});

ipcMain.handle('download-minecraft-jar', async () => {
  try {
    const versionManifestUrl = 'https://piston-meta.mojang.com/mc/game/version_manifest.json';
    const versionData = await new Promise<any>((resolve, reject) => {
      https.get(versionManifestUrl, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });

    const latestVersion = versionData.latest.release;
    const versionInfo = versionData.versions.find((v: any) => v.id === latestVersion);

    const versionDetailUrl = versionInfo.url;
    const versionDetail = await new Promise<any>((resolve, reject) => {
      https.get(versionDetailUrl, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      }).on('error', reject);
    });

    const clientJarUrl = versionDetail.downloads.client.url;

    const jarPath = path.join(app.getPath('temp'), `minecraft-${latestVersion}.jar`);
    const file = fs.createWriteStream(jarPath);

    await new Promise<void>((resolve, reject) => {
      https.get(clientJarUrl, (res) => {
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(jarPath, () => {});
        reject(err);
      });
    });

    console.log(`Downloaded Minecraft ${latestVersion} JAR to ${jarPath}`);

    const zip = new AdmZip(jarPath);
    const zipEntries = zip.getEntries();

    const rawModels: Record<string, any> = {};
    const textureFiles: Record<string, string> = {};

    zipEntries.forEach((entry) => {
      const name = entry.entryName;

      // テクスチャの抽出
      if (name.startsWith('assets/') && name.endsWith('.png')) {
        const parts = name.split('/');
        const modId = parts[1];
        const texPath = parts.slice(3).join('/').replace('.png', '');
        const base64 = `data:image/png;base64,${entry.getData().toString('base64')}`;

        textureFiles[`${modId}:${texPath}`] = base64;
        textureFiles[texPath] = base64;
        textureFiles[path.basename(name, '.png')] = base64;
      }

      // モデルの抽出
      // if (name.startsWith('assets/') && name.includes('models/block') && name.endsWith('.json')) {
      //   const parts = name.split('/');
      //   const modId = parts[1];
      //   const modelPath = parts.slice(3).join('/').replace('.json', '');
      //   const modelName = `${modId}:${modelPath}`;
      //   rawModels[modelName] = JSON.parse(entry.getData().toString('utf8'));
      // }
    });

    const finalModels: Record<string, any> = {};
    Object.keys(rawModels).forEach(name => {
      finalModels[name] = resolveFullModel(name, rawModels);
    });

    // デフォルトテクスチャ
    const textureValues = [...new Set(Object.values(textureFiles))];
    const defaultTextures = {
      "default_down": textureValues[0] || "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "default_up": textureValues[1] || textureValues[0] || "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "default_north": textureValues[2] || textureValues[0] || "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "default_south": textureValues[3] || textureValues[0] || "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "default_west": textureValues[4] || textureValues[0] || "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "default_east": textureValues[5] || textureValues[0] || "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    };

    Object.assign(textureFiles, defaultTextures);
    fs.unlinkSync(jarPath);

    return { models: finalModels, textureFiles };
  } catch (error) {
    console.error('Minecraft JAR download error:', error);
    return null;
  }
});

ipcMain.handle('save-minecraft-jar', async (_event, jarPath: string) => {
  // データ保存フォルダにminecraft.jarをコピー
  const saveDir = path.join(app.getPath('userData'), 'data');
  if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });
  const dest = path.join(saveDir, 'minecraft.jar');
  try {
    fs.copyFileSync(jarPath, dest);
    return { success: true, dest };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

ipcMain.on('config-dialog-submit', (_event, config) => {
  // データ保存フォルダにconfig.jsonとして保存
  const saveDir = path.join(app.getPath('userData'), 'data');
  if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });
  fs.writeFileSync(path.join(saveDir, 'config.json'), JSON.stringify(config, null, 2), 'utf8');
  if (configDialogWin && !configDialogWin.isDestroyed()) configDialogWin.close();
  if (win && !win.isDestroyed()) win.webContents.send('config-updated', config);
});

ipcMain.on('config-dialog-cancel', () => {
  if (configDialogWin && !configDialogWin.isDestroyed()) configDialogWin.close();
});
