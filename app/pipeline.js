// Pipeline 100% local: imagen 2D -> malla 3D "inflada" -> esqueleto -> animaciones de
// caminar/correr generadas por fórmulas (sin IA, sin red, sin créditos).
//
// Todo el módulo trabaja en "espacio de imagen" (x,y en píxeles, y hacia abajo) y convierte
// a espacio 3D (x,y,z con y hacia arriba) solo al construir la geometría/el esqueleto.

import * as THREE from 'three';

export function loadImageToCanvas(file, maxDim = 480) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, width, height);
      resolve({ canvas, ctx, width, height });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function colorDist(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

// Devuelve una máscara Uint8Array (1 = personaje, 0 = fondo).
// Usa el canal alpha si la imagen ya viene recortada (PNG transparente); si no, hace un
// flood-fill del color de fondo detectado en las esquinas, partiendo del borde del lienzo.
export function extractMask(ctx, width, height, bgThreshold = 40) {
  const { data } = ctx.getImageData(0, 0, width, height);
  const mask = new Uint8Array(width * height);

  let hasAlpha = false;
  for (let i = 3; i < data.length; i += 4 * 37) {
    if (data[i] < 250) { hasAlpha = true; break; }
  }

  if (hasAlpha) {
    for (let p = 0, i = 3; p < mask.length; p++, i += 4) {
      mask[p] = data[i] > 128 ? 1 : 0;
    }
    return mask;
  }

  const corners = [
    [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1],
  ];
  let br = 0, bg = 0, bb = 0;
  for (const [cx, cy] of corners) {
    const idx = (cy * width + cx) * 4;
    br += data[idx]; bg += data[idx + 1]; bb += data[idx + 2];
  }
  br /= 4; bg /= 4; bb /= 4;

  mask.fill(1);
  const visited = new Uint8Array(width * height);
  const stack = [];
  for (let x = 0; x < width; x++) { stack.push([x, 0]); stack.push([x, height - 1]); }
  for (let y = 0; y < height; y++) { stack.push([0, y]); stack.push([width - 1, y]); }

  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const p = y * width + x;
    if (visited[p]) continue;
    visited[p] = 1;
    const idx = p * 4;
    const d = colorDist(data[idx], data[idx + 1], data[idx + 2], br, bg, bb);
    if (d > bgThreshold) continue;
    mask[p] = 0;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return mask;
}

// Transformada de distancia (chamfer 3-4) hacia el borde más cercano del fondo, normalizada
// a [0,1]. Sirve como "mapa de profundidad" barato: el centro de la silueta sobresale más.
export function computeDepthField(mask, width, height) {
  const INF = 1e9;
  const dist = new Float32Array(width * height).fill(INF);
  for (let p = 0; p < mask.length; p++) if (!mask[p]) dist[p] = 0;

  const at = (x, y) => (x < 0 || y < 0 || x >= width || y >= height) ? INF : dist[y * width + x];
  const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < width && y < height) { const p = y * width + x; if (v < dist[p]) dist[p] = v; } };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      let d = dist[y * width + x];
      d = Math.min(d, at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.4, at(x + 1, y - 1) + 1.4);
      set(x, y, d);
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      if (!mask[y * width + x]) continue;
      let d = dist[y * width + x];
      d = Math.min(d, at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.4, at(x - 1, y + 1) + 1.4);
      set(x, y, d);
    }
  }

  let max = 1;
  for (let p = 0; p < dist.length; p++) if (mask[p] && dist[p] < INF && dist[p] > max) max = dist[p];

  const depth = new Float32Array(width * height);
  for (let p = 0; p < dist.length; p++) depth[p] = mask[p] ? Math.sqrt(dist[p] / max) : 0;

  // suavizado (box blur) para un aspecto "inflado" en vez de facetado
  return boxBlur(depth, width, height, 2);
}

function boxBlur(field, width, height, radius) {
  const out = new Float32Array(field.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0, count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < width && ny < height) { sum += field[ny * width + nx]; count++; }
        }
      }
      out[y * width + x] = sum / count;
    }
  }
  return out;
}

// Estima proporciones humanoides a partir de la silueta: altura de cadera (donde las piernas
// se separan en dos columnas), hombros, cuello y ancho de brazos. Sirve como valores por
// defecto que el usuario puede ajustar en la UI antes de generar el modelo.
export function estimateJoints(mask, width, height) {
  let top = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    let any = false;
    for (let x = 0; x < width; x++) if (mask[y * width + x]) { any = true; break; }
    if (any) { if (top < 0) top = y; bottom = y; }
  }
  if (top < 0) { top = 0; bottom = height - 1; }
  const h = bottom - top;

  function rowSegments(y) {
    let segments = 0, inSeg = false;
    for (let x = 0; x < width; x++) {
      const inside = !!mask[y * width + x];
      if (inside && !inSeg) { segments++; inSeg = true; }
      if (!inside) inSeg = false;
    }
    return segments;
  }

  let hipY = top + Math.round(h * 0.5);
  for (let y = bottom - Math.round(h * 0.05); y > top + h * 0.3; y--) {
    if (rowSegments(y) >= 2) hipY = y; else break;
  }

  function rowExtent(y) {
    let minX = -1, maxX = -1;
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) { if (minX < 0) minX = x; maxX = x; }
    }
    return { minX, maxX };
  }

  const centerRow = rowExtent(top + Math.round(h * 0.4));
  const centerX = centerRow.minX >= 0 ? (centerRow.minX + centerRow.maxX) / 2 : width / 2;

  return {
    headTopY: top,
    neckY: top + Math.round(h * 0.18),
    shoulderY: top + Math.round(h * 0.22),
    hipY,
    kneeY: hipY + Math.round((bottom - hipY) * 0.5),
    feetY: bottom,
    centerX,
    height: h,
  };
}
