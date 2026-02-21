export async function loadConfig(): Promise<any> {
    if (!(window as any).ipcRenderer)
        return { cameraType: 'orthographic', near: 0.1, far: 100, light: 1 };

    try {
        const config = await (window as any).ipcRenderer.invoke('get-config');
        return config;
    } catch (e) {
        return { cameraType: 'orthographic', near: 0.1, far: 100, light: 1 };
    }
}
