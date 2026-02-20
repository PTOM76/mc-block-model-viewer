const CameraControlPanel = ({data, selectedModel, t}: any) => {
    const handleResetCamera = () => {
        if ((window as any).__resetCamera) {
            (window as any).__resetCamera();
        }
    };

    // モデルが選択中のときにリセットボタンを表示
    return (data && selectedModel && (<>
        <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10, display: 'flex', gap: '5px' }}>
            <button 
                onClick={handleResetCamera} title={t('reset_camera_title')}
                style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: '4px' }}>
                {t('reset')}
            </button>
        </div>
    </>));
};

export default CameraControlPanel;