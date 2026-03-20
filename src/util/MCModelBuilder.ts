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
 * UVからThree.js Textureのrepeat/offsetを計算
 */
export function getTextureTransform(uv: [number, number, number, number]) {
  const repeat = {
    x: (uv[2] - uv[0]) / 16,
    y: (uv[3] - uv[1]) / 16,
  };
  const offset = {
    x: uv[0] / 16,
    y: 1 - uv[3] / 16,
  };
  return { repeat, offset };
}
