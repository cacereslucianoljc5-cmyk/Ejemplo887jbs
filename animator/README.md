# Animador: imagen/modelo 3D → animaciones (mocap real)

Estado y cómo continuar (para retomar en otra sesión).

## Qué funciona (probado)
- **Pipeline completo, corrido localmente (Node + three.js, sin GPU):** modelo `.glb`/`.obj` → auto-rig heurístico (13 huesos) → **retarget de mocap real (BVH)** con `SkeletonUtils.retargetClip` → `.glb` con las animaciones.
- **Fuente de mocap que FUNCIONA:** CMU en formato BVH: `https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/{SUBJ3}/{SUBJ2}_{TRIAL}.bvh` (ej. `data/009/09_01.bvh`).
- **IDs CMU usados:** caminar `02_01`, correr `09_01`, saltar `16_01`, patear `74_03`, golpear `02_05`, bailar `60_01`. Índice: `una-dinosauria/cmu-mocap/cmu-mocap-index-text.txt`.
- También funciona el BVH de three.js `examples/models/bvh/pirouette.bvh` (esqueleto BioVision/Daz).
- **Bandai-Namco BVH NO funcionó** de una: su `joint_Root` extra / eje distinto rompe la orientación (queda acostado). Usar CMU o Daz.

## Mapa de huesos (target de mi rig → joint del BVH)
- **CMU:** hip=`Hips`; hips→Hips, spine→Spine1, head→Head, leftUpperArm→LeftArm, leftLowerArm→LeftForeArm, rightUpperArm→RightArm, rightLowerArm→RightForeArm, leftUpperLeg→LeftUpLeg, leftLowerLeg→LeftLeg, leftFoot→LeftFoot, rightUpperLeg→RightUpLeg, rightLowerLeg→RightLeg, rightFoot→RightFoot.
- **Daz/pirouette:** hip=`hip`; spine→chest, head→head, {left,right}UpperArm→{l,r}Shldr, LowerArm→{l,r}ForeArm, UpperLeg→{l,r}Thigh, LowerLeg→{l,r}Shin, Foot→{l,r}Foot.

## Scripts
- `retarget.mjs <model.glb> <anim.bvh> <outname> <preset>` — 1 animación. preset = `cmu` | `pirouette` | `bandai`.
- `buildlib.mjs` — arma un `.glb` con varias animaciones CMU (editar la lista `LIB`).
- Requisitos: `npm i three@0.171.0`. Node 22. Incluye polyfill de `FileReader` para que `GLTFExporter` binario ande en Node.

## Problemas conocidos / pendientes
1. **Brazos horizontales** en reposo: la pose-T del mocap CMU deja los brazos abiertos. Pulir (ajustar rest pose del rig o rotación de hombros).
2. **Deformación blanda/exagerada**: el skinning es heurístico por zonas. **Solución en curso: UniRig** (auto-rig neural en GPU, `colab/UniRig_Colab.ipynb`). 

## Próximo paso
Correr **UniRig** (`colab/UniRig_Colab.ipynb`) para riggear el modelo con IA (esqueleto + skinning neural). Después **retargetear el mocap CMU al esqueleto de UniRig** (inspeccionar los nombres de huesos que genera UniRig y ajustar el mapa) → deformación de nivel pro.

## Visor
Probar los `.glb` animados en https://gltf-viewer.donmccurdy.com (menú Animations).
