# Imagen → 3D libre y gratuita (sin créditos, sin cuentas, sin red)

Alternativa 100% local a la parte de Meshy AI que se documenta en
`../docs/meshy-ai-proceso.md`: subes una imagen y obtienes un modelo 3D con esqueleto y
animaciones de **caminar** y **correr**, listo para exportar en `.glb`. Todo corre en el
navegador con JavaScript; no se sube ninguna imagen a ningún servidor, no requiere API key ni
tiene límite de usos.

## Cómo correrlo

Los módulos ES (`import`/`export`) no funcionan al abrir `index.html` directamente con
`file://` en la mayoría de navegadores por restricciones de CORS. Sirve la carpeta con
cualquier servidor estático, por ejemplo:

```bash
cd app
python3 -m http.server 8080
# abre http://localhost:8080/ en el navegador
```

o `npx serve .`, o la extensión "Live Server" de VS Code — cualquier servidor estático sirve,
no hace falta build ni Node en producción.

## Qué hace, paso a paso (`pipeline.js` + `rigbuilder.js`)

1. **Máscara del personaje** (`extractMask`): si la imagen ya tiene fondo transparente (PNG con
   alpha) se usa el canal alpha. Si no, se detecta el color de las esquinas y se hace un
   flood-fill desde el borde del lienzo para quitar el fondo, sin tocar zonas internas del
   mismo color (por ejemplo, un cinturón negro no desaparece aunque el fondo también sea negro).
2. **Mapa de profundidad barato** (`computeDepthField`): transformada de distancia (chamfer)
   desde cada píxel del personaje hasta el borde de la silueta más cercano, suavizada con un
   box-blur. El centro de la silueta queda "más alto" que los bordes — el mismo truco que usan
   los efectos de "foto 3D en relieve" (paper-cutout / lenticular), sin ningún modelo de IA.
3. **Malla 3D "inflada"** (`buildMesh`): se genera una rejilla a partir de la imagen
   (downsampleada), con una capa frontal desplazada hacia afuera según el mapa de profundidad y
   una capa trasera desplazada hacia adentro, unidas por un borde lateral para cerrar el
   volumen. Cada vértice lleva el color original de la imagen (no hay que "pintar" una textura
   aparte).
4. **Esqueleto humanoide** (`estimateJoints` + `buildSkeleton`): se estima automáticamente dónde
   están la cadera (buscando la fila donde la silueta pasa de una sola columna —el torso— a dos
   —las piernas—), los hombros, el cuello y las rodillas, a partir de proporciones típicas de un
   personaje bípedo. La UI deja ajustar estas alturas con sliders si la detección automática no
   queda perfecta para tu imagen.
5. **Skinning** (`computeSkinning`): cada vértice se asocia a 1-2 huesos según su posición
   vertical/horizontal relativa a las articulaciones estimadas, con una mezcla suave
   (`smoothstep`) cerca de cada frontera para evitar pliegues duros en la malla al animar.
6. **Animaciones de caminar y correr** (`buildCycleClip`): ciclos generados con fórmulas seno
   (sin IA, sin captura de movimiento): piernas en contrafase, rodillas que solo flexionan hacia
   adelante, brazos en contrafase con las piernas, cadera con un leve rebote vertical. "Correr" es
   el mismo ciclo con más amplitud, más frecuencia y más rebote. Esto es exactamente lo que pediste
   como "lo que viene gratis" en Meshy, pero generado por código propio en vez de descargado de un
   servicio de pago.
7. **Exportación**: `GLTFExporter` (de three.js, MIT) empaqueta la malla + esqueleto + las 3
   animaciones (Idle/Walk/Run) en un único `.glb` descargable, compatible con Blender, Godot,
   Unity, Unreal, etc.

## En qué se parece y en qué NO a Meshy AI

| | Meshy AI | Esta app |
|---|---|---|
| Reconstrucción 3D | red neuronal de difusión multi-vista + reconstrucción real (entiende volumen, espalda, huecos) | heurística 2.5D: "infla" la silueta desde una sola vista (no inventa geometría que no se ve en la foto) |
| Rigging | detector de pose entrenado, esqueleto ajustado con precisión | proporciones estimadas por reglas simples + sliders manuales |
| Animaciones | librería de 500+ animaciones con captura de movimiento real | 2 ciclos procedurales (caminar/correr) por fórmulas |
| Costo | créditos por tarea (ver tabla en `../docs/meshy-ai-proceso.md`) | cero, para siempre, cualquier imagen |
| Calidad para un personaje visto de frente (sprite de juego 2D) | muy alta | razonable — suficiente para prototipos, juegos con estética "paper cutout", mockups |

Si en algún momento quieres mejor fidelidad 3D sin depender de Meshy, se puede sustituir el paso
3-4 por un modelo open-source real (por ejemplo TripoSR o InstantMesh, ambos MIT/Apache) que
corra localmente con GPU — el resto del pipeline (rigging simplificado + animaciones
procedurales de este proyecto) seguiría funcionando igual sobre esa malla mejor reconstruida.

## Archivos

- `index.html` — interfaz (subida de imagen, sliders, visor 3D, botones de animación/descarga)
- `pipeline.js` — imagen → máscara → mapa de profundidad → estimación de articulaciones
- `rigbuilder.js` — malla 3D, esqueleto, skinning, animaciones procedurales
- `main.js` — conecta la UI con el pipeline y el visor three.js
- `vendor/` — three.js 0.160.0 vendorizado (MIT, ver `vendor/LICENSE.three.txt`), sin CDN ni
  conexión a internet
