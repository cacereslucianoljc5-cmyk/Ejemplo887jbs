# Pintor 3D v2: retro-proyección con DOS imágenes (frente + espalda).
# Mezcla por normal del vértice (frente=-Z, espalda=+Z en la malla de Hunyuan).
import sys
import numpy as np
import trimesh
from PIL import Image
from scipy import ndimage

MESH = '/root/.claude/uploads/d36c5226-0d24-54d4-8392-79fb8a21b5b8/cebd363b-hunyuan_mesh_2.glb'
FRONT = 'arquero_last.png'
BACK = 'arquero_espalda.png'
OUT = sys.argv[1] if len(sys.argv) > 1 else 'arquero_pintado_v2.glb'
FLIPF = '--flipf' in sys.argv   # espejar muestreo de la imagen frontal
FLIPB = '--flipb' not in sys.argv and True  # por defecto la espalda va espejada respecto al frente
if '--noflipb' in sys.argv: FLIPB = False
FRONT_Z = -1.0  # el frente de la malla mira a -Z (medido: botas a -Z, carcaj a +Z)

def load_filled(path):
    im = Image.open(path).convert('RGBA')
    rgba = np.array(im).astype(np.float32)
    alpha = rgba[..., 3]
    mask = alpha > 128
    dist, (iy, ix) = ndimage.distance_transform_edt(~mask, return_indices=True)
    filled = rgba[iy, ix, :3]
    ys, xs = np.where(mask)
    return filled, (ys.min(), ys.max(), xs.min(), xs.max()), im.size

fF, (fy0, fy1, fx0, fx1), _ = load_filled(FRONT)
fB, (by0, by1, bx0, bx1), _ = load_filled(BACK)

m = trimesh.load(MESH, force='mesh')
V = m.vertices
N = m.vertex_normals
xmin, ymin, _ = V.min(0)
xmax, ymax, _ = V.max(0)

u = (V[:, 0] - xmin) / (xmax - xmin)
v = (V[:, 1] - ymin) / (ymax - ymin)

def sample(filled, bb, uu, vv):
    y0, y1, x0, x1 = bb
    H, W = filled.shape[:2]
    px = np.clip((x0 + uu * (x1 - x0)).astype(int), 0, W - 1)
    py = np.clip((y1 - vv * (y1 - y0)).astype(int), 0, H - 1)
    return filled[py, px] / 255.0

uf = 1 - u if FLIPF else u
ub = (1 - uf) if FLIPB else uf
colF = sample(fF, (fy0, fy1, fx0, fx1), uf, v)
colB = sample(fB, (by0, by1, bx0, bx1), ub, v)

# peso frontal por normal (suave en los costados)
nz = N[:, 2] * FRONT_Z  # >0 mira al frente
t = np.clip((nz + 0.15) / 0.30, 0, 1)
w = (t * t * (3 - 2 * t))[:, None]
cols = w * colF + (1 - w) * colB

# suavizado leve
E = m.edges_unique
ns = np.zeros_like(cols); nc = np.zeros(len(V))
np.add.at(ns, E[:, 0], cols[E[:, 1]]); np.add.at(ns, E[:, 1], cols[E[:, 0]])
np.add.at(nc, E[:, 0], 1); np.add.at(nc, E[:, 1], 1)
cols = 0.7 * cols + 0.3 * ns / np.maximum(nc, 1)[:, None]

rgba_v = np.hstack([np.clip(cols, 0, 1) * 255, np.full((len(V), 1), 255)]).astype(np.uint8)
m.visual = trimesh.visual.ColorVisuals(m, vertex_colors=rgba_v)
m.export(OUT)
print('EXPORT', OUT, round(len(open(OUT, 'rb').read()) / 1024 / 1024, 2), 'MB | flipF', FLIPF, 'flipB', FLIPB)

# render 4 vistas
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
Vr = V[:, [0, 2, 1]].copy(); Vr -= Vr.mean(0); Vr /= np.abs(Vr).max()
F = m.faces; tris = Vr[F]; fc = cols[F].mean(1)
nn = np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0]); nn /= (np.linalg.norm(nn, axis=1, keepdims=True) + 1e-9)
views = [('frente', 8, -90), ('3/4', 8, -45), ('lado', 8, 0), ('atras', 8, 90)]
fig = plt.figure(figsize=(13, 4.6))
for i, (name, el, az) in enumerate(views):
    ax = fig.add_subplot(1, 4, i + 1, projection='3d')
    ld = np.array([np.cos(np.radians(az + 20)), np.sin(np.radians(az + 20)), 0.6]); ld /= np.linalg.norm(ld)
    sh = (np.clip(nn @ ld, 0, 1) * 0.3 + 0.7)[:, None]
    ax.add_collection3d(Poly3DCollection(tris, facecolors=np.clip(fc * sh, 0, 1), edgecolors='none'))
    ax.view_init(elev=el, azim=az)
    ax.set_xlim(-1, 1); ax.set_ylim(-1, 1); ax.set_zlim(-1, 1)
    ax.set_box_aspect((1, 1, 1)); ax.axis('off'); ax.set_title(name, fontsize=9)
plt.tight_layout(); plt.savefig('pintado_v2_views.png', dpi=95, bbox_inches='tight')
print('saved pintado_v2_views.png')
