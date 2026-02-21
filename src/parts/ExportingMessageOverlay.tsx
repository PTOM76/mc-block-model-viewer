const ExportingMessageOverlay = ({msg}: {msg: string}) => {
    return (
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
        }}>{msg}</div>
    );
};

export default ExportingMessageOverlay;
