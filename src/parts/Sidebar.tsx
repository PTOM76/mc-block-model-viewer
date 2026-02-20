import ModelList from "./ModelList";

const SideBar = ({data, setData, selectedModel, setSelectedModel, handleExportImage, mergeData, t}: any) => {
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

    return (
        <div style={{ minWidth: '150px', width: '200px', borderRight: `1px solid ${"var(--border-color)"}`, padding: '10px', color: "var(--text-color)" }}>
        <button onClick={handlePickFile} className="sidebar-button">{t('open_jar')}</button>
            <button onClick={handleDownloadMinecraft} className="sidebar-button">{t('download_minecraft_jar')}</button>
            {data && selectedModel && (<>
            <button onClick={handleClearData} className="sidebar-button">{t('clear_all')}</button>
            <button onClick={handleExportImage} className="sidebar-button last">{t('save_as_image')}</button>
            </>)}

            <ModelList data={data} selectedModel={selectedModel} setSelectedModel={setSelectedModel} />
        </div>
    );
};

export default SideBar;
