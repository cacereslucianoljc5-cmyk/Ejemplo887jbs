// Construye la malla 3D "inflada" (front+back shell texturizado con la imagen original),
// el esqueleto humanoide y las animaciones de caminar/correr, todo con fórmulas -> sin IA.

import * as THREE from 'three';

const BONE_NAMES = [
  'Hips', 'Spine', 'Head',
  'LeftUpperArm', 'LeftLowerArm',
  'RightUpperArm', 'RightLowerArm',
  'LeftUpperLeg', 'LeftLowerLeg',
  'RightUpperLeg', 'RightLowerLeg',
];

function toWorld(px, py, width, height, scale) {
  return new THREE.Vector3((px - width / 2) * scale, (height / 2 - py) * scale, 0);
}

export function buildMesh(canvas, mask, depth, width, height, opts) {
  const { gridStep = 4, puffFront = 0.22, puffBack = 0.12, scale = 1 / Math.max(width, height) } = opts;
  const cols = Math.floor(width / gridStep);
  const rows = Math.floor(height / gridStep);

  const sample = (field, gx, gy) => field[Math.min(height - 1, gy * gridStep) * width + Math.min(width - 1, gx * gridStep)];
  const sampleColor = (() => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const { data } = ctx.getImageData(0, 0, width, height);
    return (px, py) => {
      const idx = (Math.min(height - 1, py) * width + Math.min(width - 1, px)) * 4;
      return [data[idx] / 255, data[idx + 1] / 255, data[idx + 2] / 255];
    };
  })();

  const insideAt = (gx, gy) => gx >= 0 && gy >= 0 && gx < cols && gy < rows && sample(mask, gx, gy) === 1;

  const positions = [];
  const normals = [];
  const uvs = [];
  const colors = [];
  const indices = [];
  const gridInfo = []; // {px, py} per emitted vertex, in original pixel space — used for skinning

  // índice de vértice frontal/trasero por celda de rejilla (-1 si no existe)
  const frontIdx = new Int32Array(cols * rows).fill(-1);
  const backIdx = new Int32Array(cols * rows).fill(-1);

  function emit(px, py, z, u, v, rgb) {
    positions.push((px - width / 2) * scale, (height / 2 - py) * scale, z);
    normals.push(0, 0, z >= 0 ? 1 : -1);
    uvs.push(u, v);
    colors.push(rgb[0], rgb[1], rgb[2]);
    gridInfo.push({ px, py });
    return gridInfo.length - 1;
  }

  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      if (!insideAt(gx, gy)) continue;
      const px = gx * gridStep, py = gy * gridStep;
      const d = sample(depth, gx, gy);
      const rgb = sampleColor(px, py);
      const u = px / width, v = 1 - py / height;
      frontIdx[gy * cols + gx] = emit(px, py, d * puffFront, u, v, rgb);
      backIdx[gy * cols + gx] = emit(px, py, -d * puffBack, u, v, rgb);
    }
  }

  function quad(a, b, c, d, flip) {
    if (flip) indices.push(a, c, b, a, d, c);
    else indices.push(a, b, c, a, c, d);
  }

  for (let gy = 0; gy < rows - 1; gy++) {
    for (let gx = 0; gx < cols - 1; gx++) {
      const i00 = gy * cols + gx, i10 = i00 + 1, i01 = i00 + cols, i11 = i01 + 1;
      if (insideAt(gx, gy) && insideAt(gx + 1, gy) && insideAt(gx, gy + 1) && insideAt(gx + 1, gy + 1)) {
        quad(frontIdx[i00], frontIdx[i10], frontIdx[i11], frontIdx[i01], false);
        quad(backIdx[i00], backIdx[i10], backIdx[i11], backIdx[i01], true);
      }
    }
  }

  // Bordes laterales: para cada celda de rejilla dentro de la silueta, si el vecino está
  // afuera, generamos un quad delgado front->back en esa arista para cerrar el volumen.
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      if (!insideAt(gx, gy)) continue;
      const i = gy * cols + gx;
      const f0 = frontIdx[i], b0 = backIdx[i];
      const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dy] of neighbors) {
        const ngx = gx + dx, ngy = gy + dy;
        if (insideAt(ngx, ngy)) continue;
        const ni = ngy * cols + ngx;
        const f1 = (ngx >= 0 && ngy >= 0 && ngx < cols && ngy < rows) ? frontIdx[ni] : -1;
        const b1 = (ngx >= 0 && ngy >= 0 && ngx < cols && ngy < rows) ? backIdx[ni] : -1;
        if (f1 === -1 || b1 === -1) {
          // vecino fuera de la rejilla o fuera de la silueta sin vértice propio: usamos
          // el mismo vértice desplazado (pared recta hacia el borde de la celda vecina)
          indices.push(f0, b0, b0);
          continue;
        }
        const flip = dx > 0 || dy < 0;
        quad(f0, f1, b1, b0, flip);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return { geometry, gridInfo, scale };
}

export function buildSkeleton(joints, width, height, scale) {
  const p = (px, py) => toWorld(px, py, width, height, scale);
  const bones = {};

  bones.Hips = new THREE.Bone(); bones.Hips.name = 'Hips';
  bones.Hips.position.copy(p(joints.centerX, joints.hipY));

  bones.Spine = new THREE.Bone(); bones.Spine.name = 'Spine';
  bones.Spine.position.copy(p(joints.centerX, joints.shoulderY).sub(bones.Hips.position));
  bones.Hips.add(bones.Spine);

  bones.Head = new THREE.Bone(); bones.Head.name = 'Head';
  bones.Head.position.copy(p(joints.centerX, joints.headTopY).sub(p(joints.centerX, joints.shoulderY)));
  bones.Spine.add(bones.Head);

  const armSpan = joints.height * 0.22;
  for (const side of ['Left', 'Right']) {
    const sign = side === 'Left' ? -1 : 1;
    const upper = new THREE.Bone(); upper.name = side + 'UpperArm';
    upper.position.copy(p(joints.centerX + sign * armSpan * 0.3, joints.shoulderY).sub(p(joints.centerX, joints.shoulderY)));
    bones.Spine.add(upper);
    const lower = new THREE.Bone(); lower.name = side + 'LowerArm';
    lower.position.set(sign * armSpan * 0.6, -armSpan * 0.5, 0);
    upper.add(lower);
    bones[side + 'UpperArm'] = upper;
    bones[side + 'LowerArm'] = lower;

    const legSign = sign;
    const upperLeg = new THREE.Bone(); upperLeg.name = side + 'UpperLeg';
    upperLeg.position.copy(p(joints.centerX + legSign * joints.height * 0.08, joints.hipY).sub(bones.Hips.position));
    bones.Hips.add(upperLeg);
    const lowerLeg = new THREE.Bone(); lowerLeg.name = side + 'LowerLeg';
    lowerLeg.position.copy(p(joints.centerX + legSign * joints.height * 0.08, joints.kneeY).sub(p(joints.centerX + legSign * joints.height * 0.08, joints.hipY)));
    upperLeg.add(lowerLeg);
    bones[side + 'UpperLeg'] = upperLeg;
    bones[side + 'LowerLeg'] = lowerLeg;
  }

  const boneList = BONE_NAMES.map((n) => bones[n]);
  const skeleton = new THREE.Skeleton(boneList);
  return { skeleton, bones, root: bones.Hips };
}

export function computeSkinning(geometry, gridInfo, joints, bones) {
  const boneIndexOf = {};
  BONE_NAMES.forEach((n, i) => { boneIndexOf[n] = i; });

  const skinIndices = [];
  const skinWeights = [];
  const feather = joints.height * 0.06;

  function smoothstep(edge0, edge1, x) {
    const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  for (const { px, py } of gridInfo) {
    const side = px >= joints.centerX ? 'Right' : 'Left';
    let boneA, boneB, w = 1;

    if (py < joints.shoulderY - feather) {
      boneA = 'Head'; boneB = 'Head';
    } else if (py < joints.shoulderY + feather) {
      const t = smoothstep(joints.shoulderY - feather, joints.shoulderY + feather, py);
      boneA = 'Head'; boneB = 'Spine'; w = 1 - t;
    } else if (py < joints.hipY - feather) {
      const armWidth = joints.height * 0.16;
      const isArm = Math.abs(px - joints.centerX) > armWidth;
      if (isArm) {
        const elbowY = joints.shoulderY + (joints.hipY - joints.shoulderY) * 0.55;
        boneA = py < elbowY ? side + 'UpperArm' : side + 'LowerArm';
        boneB = boneA;
      } else {
        boneA = 'Spine'; boneB = 'Spine';
      }
    } else if (py < joints.hipY + feather) {
      const t = smoothstep(joints.hipY - feather, joints.hipY + feather, py);
      boneA = 'Spine'; boneB = side + 'UpperLeg'; w = 1 - t;
    } else if (py < joints.kneeY - feather) {
      boneA = side + 'UpperLeg'; boneB = side + 'UpperLeg';
    } else if (py < joints.kneeY + feather) {
      const t = smoothstep(joints.kneeY - feather, joints.kneeY + feather, py);
      boneA = side + 'UpperLeg'; boneB = side + 'LowerLeg'; w = 1 - t;
    } else {
      boneA = side + 'LowerLeg'; boneB = side + 'LowerLeg';
    }

    const ia = boneIndexOf[boneA] ?? boneIndexOf.Hips;
    const ib = boneIndexOf[boneB] ?? boneIndexOf.Hips;
    skinIndices.push(ia, ib, 0, 0);
    skinWeights.push(w, 1 - w, 0, 0);
  }

  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
}

function qAxisAngle(axis, angleRad) {
  return new THREE.Quaternion().setFromAxisAngle(axis, angleRad);
}

const X = new THREE.Vector3(1, 0, 0);

// Genera un ciclo de animación procedural (sin IA): piernas y brazos oscilan en contrafase,
// cadera con leve rebote vertical/rotación. `intensity` 1 = caminar, ~1.8 = correr.
export function buildCycleClip(name, bones, { duration = 1, legAmplitude = 0.5, armAmplitude = 0.4, kneeBend = 0.9, hipBob = 0.02, intensity = 1 }) {
  const fps = 24;
  const frameCount = Math.round(duration * fps);
  const times = [];
  for (let i = 0; i <= frameCount; i++) times.push((i / frameCount) * duration);

  const tracks = [];

  function addRotationTrack(boneName, fn) {
    const bone = bones[boneName];
    if (!bone) return;
    const values = [];
    for (const t of times) {
      const phase = (t / duration) * Math.PI * 2;
      const q = fn(phase);
      values.push(q.x, q.y, q.z, q.w);
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone.name}.quaternion`, times, values));
  }

  addRotationTrack('LeftUpperLeg', (ph) => qAxisAngle(X, Math.sin(ph) * legAmplitude));
  addRotationTrack('RightUpperLeg', (ph) => qAxisAngle(X, Math.sin(ph + Math.PI) * legAmplitude));
  addRotationTrack('LeftLowerLeg', (ph) => qAxisAngle(X, Math.max(0, -Math.sin(ph)) * kneeBend));
  addRotationTrack('RightLowerLeg', (ph) => qAxisAngle(X, Math.max(0, -Math.sin(ph + Math.PI)) * kneeBend));
  addRotationTrack('LeftUpperArm', (ph) => qAxisAngle(X, Math.sin(ph + Math.PI) * armAmplitude));
  addRotationTrack('RightUpperArm', (ph) => qAxisAngle(X, Math.sin(ph) * armAmplitude));
  addRotationTrack('Spine', (ph) => qAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin(ph) * 0.05 * intensity));

  const hipsBone = bones.Hips;
  if (hipsBone) {
    const posValues = [];
    const baseY = hipsBone.position.y;
    for (const t of times) {
      const phase = (t / duration) * Math.PI * 2;
      posValues.push(hipsBone.position.x, baseY + Math.abs(Math.sin(phase * 2)) * hipBob, hipsBone.position.z);
    }
    tracks.push(new THREE.VectorKeyframeTrack(`${hipsBone.name}.position`, times, posValues));
  }

  return new THREE.AnimationClip(name, duration, tracks);
}

export { BONE_NAMES };
