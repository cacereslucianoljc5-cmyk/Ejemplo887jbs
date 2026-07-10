# Pintor 3D por retro-proyección (lógica pixel-aligned tipo Pixal3D, sin GPU):
# proyecta la imagen frontal sobre la malla, con relleno nearest para zonas
# fuera de máscara, y hornea colores por vértice. Exporta GLB con COLOR_0.
import sys
import numpy as np
import trimesh
from PIL import Image
from scipy import ndimage

MESH = sys.argv[1] if len(sys.argv) > 1 else '/root/.claude/uploads/d36c5226-0d24-54d4-8392-79fb8a21b5b8/cebd363b-hunyuan_mesh_2.glb'
IMG = sys.argv[2] if len(sys.argv) > 2 else 'arquero_last.png'
OUT = sys.argv[3] if len(sys.argv) > 3 else 'arquero_pintado.glb'
FLIP_X = '--flipx' in sys.argv

# --- imagen: máscara + mapa de relleno nearest (sin bordes blancos) ---
im = Image.open(IMG).convert('RGBA')
rgba = np.array(im).astype(np.float32)
H, W = rgba.shape[:2]
alpha = rgba[..., 3]
mask = alpha > 128
# indices del pixel en-máscara más cercano para cada pixel
dist, (iy, ix) = ndimage.distance_transform_edt(~mask, return_indices=True)
filled = rgba[iy, ix, :3]  # imagen rellenada hacia afuera con el color más cercano
# bbox del contenido
ys, xs = np.where(mask)
y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()

# --- malla ---
m = trimesh.load(MESH, force='mesh')
V = m.vertices
xmin, ymin, zmin = V.min(0)
xmax, ymax, zmax = V.max(0)

# proyección ortográfica frontal: x_malla -> columna, y_malla -> fila (invertida)
u = (V[:, 0] - xmin) / (xmax - xmin)
if FLIP_X:
    u = 1.0 - u
v = (V[:, 1] - ymin) / (ymax - ymin)
px = np.clip((x0 + u * (x1 - x0)).astype(int), 0, W - 1)
py = np.clip((y1 - v * (y1 - y0)).astype(int), 0, H - 1)
cols = filled[py, px] / 255.0

# --- suavizado laplaciano leve de color (quita moteado) ---
E = m.edges_unique
neigh_sum = np.zeros_like(cols)
neigh_cnt = np.zeros(len(V))
np.add.at(neigh_sum, E[:, 0], cols[E[:, 1]])
np.add.at(neigh_sum, E[:, 1], cols[E[:, 0]])
np.add.at(neigh_cnt, E[:, 0], 1)
np.add.at(neigh_cnt, E[:, 1], 1)
lam = 0.35
cols = (1 - lam) * cols + lam * neigh_sum / np.maximum(neigh_cnt, 1)[:, None]

rgba_v = np.hstack([np.clip(cols, 0, 1) * 255, np.full((len(V), 1), 255)]).astype(np.uint8)
m.visual = trimesh.visual.ColorVisuals(m, vertex_colors=rgba_v)
m.export(OUT)
print('EXPORT', OUT, round(len(open(OUT, 'rb').read()) / 1024 / 1024, 2), 'MB')

# --- render de verificación (4 vistas, colores reales) ---
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

Vr = V[:, [0, 2, 1]].copy()
Vr -= Vr.mean(0)
Vr /= np.abs(Vr).max()
F = m.faces
tris = Vr[F]
fc = cols[F].mean(1)
n = np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0])
n /= (np.linalg.norm(n, axis=1, keepdims=True) + 1e-9)
views = [('frente', 8, -90), ('3/4', 8, -45), ('lado', 8, 0), ('atras', 8, 90)]
fig = plt.figure(figsize=(13, 4.6))
for i, (name, el, az) in enumerate(views):
    ax = fig.add_subplot(1, 4, i + 1, projection='3d')
    ld = np.array([np.cos(np.radians(az + 20)), np.sin(np.radians(az + 20)), 0.6])
    ld /= np.linalg.norm(ld)
    sh = (np.clip(n @ ld, 0, 1) * 0.35 + 0.65)[:, None]
    ax.add_collection3d(Poly3DCollection(tris, facecolors=np.clip(fc * sh, 0, 1), edgecolors='none'))
    ax.view_init(elev=el, azim=az)
    ax.set_xlim(-1, 1); ax.set_ylim(-1, 1); ax.set_zlim(-1, 1)
    ax.set_box_aspect((1, 1, 1)); ax.axis('off'); ax.set_title(name, fontsize=9)
plt.tight_layout()
plt.savefig('pintado_views.png', dpi=95, bbox_inches='tight')
print('saved pintado_views.png')
