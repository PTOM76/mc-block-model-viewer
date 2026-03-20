/**
 * テクスチャパスの解決
 */
export function lookupTexturePath(path: string, textureMap: Record<string, string>): string | null {
  if (!path) return null;
  if (textureMap[path]) return textureMap[path];
  const noMinecraft = path.replace('minecraft:', '');
  if (textureMap[noMinecraft]) return textureMap[noMinecraft];
  const onlyPath = noMinecraft.includes(':') ? noMinecraft.split(':')[1] : noMinecraft;
  if (textureMap[onlyPath]) return textureMap[onlyPath];
  const fileName = onlyPath.split('/').pop() || '';
  if (textureMap[fileName]) return textureMap[fileName];
  return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
}

/**
 * #付きテクスチャキーの解決
 */
export function resolveTextureKey(texKey: string, textures: Record<string, string>): string {
  let currentPath = textures[texKey] || texKey;
  let safety = 0;
  while (typeof currentPath === 'string' && currentPath.startsWith('#') && safety < 10) {
    const nextKey = currentPath.replace('#', '');
    currentPath = textures[nextKey] || nextKey;
    safety++;
  }
  return currentPath;
}

/**
 * UV情報の正規化
 */
export function resolveUV(uv?: number[]): [number, number, number, number] {
  // デフォルトは [0, 0, 16, 16]
  if (!uv || uv.length !== 4) return [0, 0, 16, 16];
  return [uv[0], uv[1], uv[2], uv[3]];
}

/**
 * BoxGeometryのfaceの各頂点(TL, TR, BL, BRの4点)用のUV配列を返す
 * @param uv [u1, v1, u2, v2]
 * @param rotation 0/90/180/270
 * @returns 要素数8の配列 (BoxGeometryのuvAttributeにおける該当面の8要素分)
 */
export function getFaceUVs(uv: [number, number, number, number], rotation: number = 0) {
  const uL = uv[0] / 16;
  const vT = 1.0 - uv[1] / 16;
  const uR = uv[2] / 16;
  const vB = 1.0 - uv[3] / 16;

  if (rotation === 90) {
    return [
      uL, vB,  // TL
      uL, vT,  // TR
      uR, vB,  // BL
      uR, vT   // BR
    ];
  }
  if (rotation === 180) {
    return [
      uR, vB,  // TL
      uL, vB,  // TR
      uR, vT,  // BL
      uL, vT   // BR
    ];
  }
  if (rotation === 270) {
    return [
      uR, vT,  // TL
      uR, vB,  // TR
      uL, vT,  // BL
      uL, vB   // BR
    ];
  }

  // Default 0
  return [
    uL, vT,  // TL
    uR, vT,  // TR
    uL, vB,  // BL
    uR, vB   // BR
  ];
}
