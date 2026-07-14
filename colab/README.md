# 🧊 Imagen → 3D (gratis)

Convertí una imagen de personaje en un modelo 3D con IA — gratis, en la GPU de Google Colab — y animalo (caminar/correr) en el navegador.

## Notebooks de Colab (GPU gratis)

| Notebook | Qué hace | Abrir |
|---|---|---|
| **Hunyuan3D — App web** | Interfaz web con link público (`gradio.live`). Subís imagen y bajás el 3D sin tocar código. **Recomendado.** | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/cacereslucianoljc5-cmyk/Ejemplo887jbs/blob/claude/meshy-3d-free-alternative-ekuvdr/colab/Hunyuan3D_App_Colab.ipynb) |
| **Hunyuan3D — paso a paso** | Celdas manuales, más control. Mejor calidad de geometría. | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/cacereslucianoljc5-cmyk/Ejemplo887jbs/blob/claude/meshy-3d-free-alternative-ekuvdr/colab/Hunyuan3D_Colab.ipynb) |
| **TripoSR — paso a paso** | Modelo más liviano y rápido, menor calidad. | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/cacereslucianoljc5-cmyk/Ejemplo887jbs/blob/claude/meshy-3d-free-alternative-ekuvdr/colab/Imagen_a_3D_TripoSR_Colab.ipynb) |
| **UniRig — auto-rig neural** | Convierte un `.glb`/`.obj` en un modelo **riggeado** (esqueleto + pesos con IA) para animarlo sin deformaciones. Paso previo a la animación. | [![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/cacereslucianoljc5-cmyk/Ejemplo887jbs/blob/claude/unirig-dependencies-k6mq1y/colab/UniRig_Colab.ipynb) |

### Cómo usarlas
1. Tocá el botón **Open in Colab**.
2. `Entorno de ejecución` → `Cambiar tipo` → **T4 GPU**.
3. Corré las celdas en orden (seguí las instrucciones dentro del notebook).

## Web para animar (caminar / correr)
`../web/index.html` — app 100% en el navegador: toma un `.glb`/`.obj`, le arma un esqueleto y lo anima (idle / caminar / correr), con descarga del `.glb` animado.

- **En vivo:** https://imagen-a-3d-triposr.vercel.app → botón *“Animar un modelo 3D”*.

## Notas de calidad
- La reconstrucción 3D de calidad necesita **GPU**, por eso corre en Colab.
- Calidad: **Hunyuan3D > TripoSR**. Para calidad tipo Meshy real, Meshy (con créditos) sigue siendo superior.
- El modo actual de Hunyuan genera **solo la forma** (malla gris). La textura/color es un paso extra más pesado.
