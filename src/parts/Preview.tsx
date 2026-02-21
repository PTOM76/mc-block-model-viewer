import { Canvas } from "@react-three/fiber";
import { ResponsiveOrthoCamera } from "../util/ResponsiveOrthoCamera";
import { Suspense } from "react";
import { Center } from "@react-three/drei";
import * as THREE from 'three';
import * as CameraUtil from '../util/CameraUtil';
import { ImageExporter } from '../util/ImageExporter';
import { OrbitControls } from "@react-three/drei";

// @ts-ignore
import { MCModel } from '../MCModel';

const Preview = ({data, selectedModel, config, canvasKey, handleImageData}: any) => {
    return (
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
                <perspectiveCamera position={[-1, 0.82, -1]} near={config.near} far={config.far} zoom={0.75} />
            ) : (
                <ResponsiveOrthoCamera position={[-1, 0.82, -1]} near={config.near} far={config.far} zoom={0.75} />
            )}
            <ambientLight intensity={config.light ?? 1.0} />
            <directionalLight position={[5, 10, 5]} intensity={2.0} />
            <directionalLight position={[5, 0, -5]} intensity={1.25} />
            {/* <directionalLight position={[0, -5, 0]} intensity={0.3} /> */}
            <Suspense fallback={null}>
            <Center>
                {data && selectedModel && (
                <MCModel
                    data={data.models[selectedModel]} 
                    textureMap={data.textureFiles} 
                />)}
            </Center>
            </Suspense>
            <OrbitControls />
            <CameraUtil.CameraResetter />
            <ImageExporter onExport={handleImageData} format={"png"} />
        </Canvas>
    );
};

export default Preview;