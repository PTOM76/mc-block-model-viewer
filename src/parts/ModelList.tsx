/**
 * サイドバーのモデル一覧
 */
const ModelList = ({data, selectedModel, setSelectedModel}: any) => {
    return (
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
    );
};

export default ModelList;