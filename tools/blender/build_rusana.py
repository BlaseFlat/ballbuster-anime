# Build Rusana from pixiv VRoid AvatarSample_B (conditions: alteration + redistribution allowed, not for a fee).
# blender -b --python build_rusana.py -- <AvatarSample_B.vrm> <edited_tex_dir> <out.vrm>
import bpy, bmesh, sys, os, math, random
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]
SRC, TEX, OUT = argv[0], argv[1], argv[2]
P = dict(zt=1.415, g0=0.2, g1=0.4, ls=0.56, bend=0.11, thigh=0.009, hip=0.004)
for a in argv[3:]:
    k, v = a.split('='); P[k] = float(v)
random.seed(7)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.preferences.addon_enable(module='bl_ext.user_default.vrm')
bpy.ops.import_scene.vrm(filepath=SRC)
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]

# ---- textures ----
for im in bpy.data.images:
    fn = os.path.join(TEX, bpy.path.clean_name(im.name) + '.png')
    if os.path.exists(fn):
        if im.packed_file: im.unpack(method='REMOVE')
        im.source = 'FILE'; im.filepath = fn; im.reload(); im.pack()
        print('TEX', im.name)

def delete_faces(obj, pred):
    bm = bmesh.new(); bm.from_mesh(obj.data)
    kill = [f for f in bm.faces if pred(f)]
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    bm.to_mesh(obj.data); bm.free(); obj.data.update()
    print('deleted', len(kill), 'faces from', obj.name)

# ---- body: drop jacket + skirt; mild soft-athletic shaping of thighs / hips ----
body = bpy.data.objects['Body']
mats = [m.name for m in body.data.materials]
# Jacket (Tops) and pleated skirt (Bottoms) are KEPT for the outfit shop (hidden at runtime by default).
cloth_idx = {i for i, n in enumerate(mats) if 'Tops' in n or 'Bottoms' in n}
tops_i = [i for i, n in enumerate(mats) if 'Tops' in n][0]
# crop split: lower jacket faces get their own material slot so the runtime can hide them (crop jacket)
low = body.data.materials[tops_i].copy(); low.name = mats[tops_i] + '_Low'
body.data.materials.append(low); low_i = len(body.data.materials) - 1
_mw = body.matrix_world
CROP_Z = P.get('cropz', 1.06)
for f in body.data.polygons:
    if f.material_index == tops_i and (_mw @ f.center).z < CROP_Z: f.material_index = low_i
cloth_idx.add(low_i)
cloth_v = {v for f in body.data.polygons if f.material_index in cloth_idx for v in f.vertices}
print('CLOTH verts', len(cloth_v))
vg = {g.name: g.index for g in body.vertex_groups}
me = body.data
# Shaping (world space; VRoid import has a 180° Z rotation): fuller rounder glutes, toned thighs & calves.
mw = body.matrix_world; mwi3 = mw.inverted().to_3x3(); mw3 = mw.to_3x3()
bw = lambda name: arm.matrix_world @ arm.data.bones[name].head_local
hipz, kneez = bw('J_Bip_C_Hips').z, (bw('J_Bip_L_LowerLeg').z + bw('J_Bip_R_LowerLeg').z) / 2
toe, foot = bw('J_Bip_L_ToeBase'), bw('J_Bip_L_Foot')
back = Vector((0, -1 if toe.y > foot.y else 1, 0))
print('SHAPE hipz %.3f kneez %.3f back %s' % (hipz, kneez, tuple(back)))
gz = hipz + P.get('gz', -0.08)
for v in me.vertices:
    w = 0.0; wh = 0.0; wl = 0.0
    if v.index in cloth_v:
        wh = 1.0 if (mw @ v.co).z < hipz + 0.12 else 0.0     # skirt/jacket hem follow hips & glutes
    else:
        for g in v.groups:
            n = body.vertex_groups[g.group].name
            if 'UpperLeg' in n: w += g.weight
            if 'LowerLeg' in n: wl += g.weight
            if n == 'J_Bip_C_Hips': wh += g.weight
    if w <= 0 and wh <= 0 and wl <= 0: continue
    p = mw @ v.co; nw = (mw3 @ v.normal).normalized(); d = Vector((0, 0, 0))
    fb = max(0.0, nw.dot(back))
    # thighs: fuller along the whole thigh, fading out at the knee
    if w > 0:
        fade = max(0.0, min(1.0, (p.z - kneez - 0.03) / 0.16))
        d += nw * (P['thigh'] * w * fade)
    if wh > 0 and p.z < hipz + 0.12:
        d += nw * (P['hip'] * wh)
    # glutes: two soft round bumps on the back, slightly lifted
    zg = math.exp(-((p.z - gz) / P.get('gw', 0.075)) ** 2)
    xg = math.exp(-((abs(p.x) - 0.068) / 0.075) ** 2)
    ga = P.get('glute', 0.025) * fb ** 1.3 * zg * xg * min(1.0, w + wh)
    d += nw * ga + Vector((0, 0, 0.25 * ga))
    # calves: toned bulge at the upper back of the lower leg
    if wl > 0:
        cz = math.exp(-((p.z - (kneez - 0.14)) / 0.09) ** 2)
        d += nw * (P.get('calf', 0.006) * wl * cz * (0.35 + 0.65 * fb))
    v.co += mwi3 @ d

# ---- hair: remove accessories (pins/stars, earrings, horns) and the twin side tufts; long back hair -> ponytail ----
hair = bpy.data.objects['Hair001']
mw = hair.matrix_world
bm = bmesh.new(); bm.from_mesh(hair.data); bm.faces.ensure_lookup_table()
seen = set(); parts = []
for f in bm.faces:
    if f.index in seen: continue
    st = [f]; comp = []; seen.add(f.index)
    while st:
        g = st.pop(); comp.append(g)
        for e in g.edges:
            for h in e.link_faces:
                if h.index not in seen: seen.add(h.index); st.append(h)
    parts.append(comp)
kill = []; long_parts = []
for comp in parts:
    vs = {v for g in comp for v in g.verts}
    W = [mw @ v.co for v in vs]
    zs = [p.z for p in W]; ys = [p.y for p in W]; xs = [p.x for p in W]
    mi = comp[0].material_index
    if mi in (2, 3, 5): kill += comp; continue
    if min(zs) < 1.2: long_parts.append((comp, vs)); continue
    # twin "side-up" tufts: back half, mid height, off-centre
    if min(zs) > 1.2 and min(zs) < 1.31 and min(ys) > 0.04 and max(abs(x) for x in xs) > 0.13 and mi == 1:
        kill += comp; continue
# ponytail deformation on long back strands
zt, g0, g1, ls = P['zt'], P['g0'], P['g1'], P['ls']
# tie depth: just behind the hair surface at tie height
WP = [mw @ v.co for comp, vs in long_parts for v in vs]
yt = max(p.y for p in WP if abs(p.z - zt) < 0.02 and abs(p.x) < 0.04) + 0.012
zmin = min(p.z for p in WP)
print('tie', zt, yt, 'zmin', zmin)
def smooth(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)
def pony(p, jit=(0, 0)):
    x, y, z = p
    if z >= zt:
        w = smooth(zt + 0.11, zt, z)
        return Vector((x * (1 - w * (1 - g0)), y + w * (yt - y) * 0.85, z))
    u = (zt - z) / (zt - zmin)
    g = g0 + (g1 - g0) * math.sin(u * math.pi * 0.5)
    yy = yt + (y - (0.13 + 0.12 * u)) * 0.55 + P['bend'] * math.sin(min(1, u * 1.6) * math.pi * 0.5) - 0.03 * u * u
    return Vector((x * g + jit[0] * u, yy + jit[1] * u, zt - (zt - z) * ls))
for comp, vs in long_parts:
    jit = (random.uniform(-0.035, 0.035), random.uniform(-0.02, 0.025))
    mwi = mw.inverted()
    for v in vs: v.co = mwi @ pony(mw @ v.co, jit)
bmesh.ops.delete(bm, geom=list({f for f in kill}), context='FACES')
bm.to_mesh(hair.data); bm.free(); hair.data.update()
# same deformation for the spring-bone chain that drives the long hair
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
eb = arm.data.edit_bones
root = [b for b in eb if b.name.startswith('HairJoint-df29e53e')][0]
chain = [root] + list(root.children_recursive)
for b in chain:
    h, t = pony(b.head.copy()), pony(b.tail.copy())
    b.head, b.tail = h, t
bpy.ops.object.mode_set(mode='OBJECT')

# ---- hair tie (uses the burgundy crop-top area of the body texture) ----
bpy.ops.mesh.primitive_torus_add(major_radius=0.024, minor_radius=0.009, major_segments=20, minor_segments=8, location=(0, yt - 0.004, zt - 0.005), rotation=(math.radians(-28), 0, 0))
tie = bpy.context.active_object; tie.name = 'HairTie'
for p in tie.data.polygons: p.use_smooth = True
uvl = tie.data.uv_layers.active or tie.data.uv_layers.new()
for l in uvl.data: l.uv = (0.5 + random.uniform(-0.004, 0.004), 1 - 0.87)   # hidden scalp texel painted with the tie colour
tie.data.materials.append(body.data.materials[mats.index([m for m in mats if 'Body' in m][0])])
g = tie.vertex_groups.new(name='J_Bip_C_Head'); g.add(list(range(len(tie.data.vertices))), 1.0, 'REPLACE')
mod = tie.modifiers.new('Armature', 'ARMATURE'); mod.object = arm
tie.parent = arm
# join tie into the body mesh so it shares the body material/primitive
bpy.ops.object.select_all(action='DESELECT'); tie.select_set(True); body.select_set(True)
bpy.context.view_layer.objects.active = body; bpy.ops.object.join()

# ---- drop spring groups that no longer have geometry (skirt/coat/horns/tufts are harmless but waste cpu) ----
sa = arm.data.vrm_addon_extension.vrm0.secondary_animation
names = {b.name for b in arm.data.bones}
for i in reversed(range(len(sa.bone_groups))):
    gp = sa.bone_groups[i]
    bn = [b.bone_name for b in gp.bones]
    if any(n.startswith(('HairJoint-a8676c3f', 'HairJoint-6860b79f', 'HairJoint-b91b9ff0', 'HairJoint-0ac4a3ee')) for n in bn):
        sa.bone_groups.remove(i); continue
    if any(n.startswith('HairJoint-df29e53e') for n in bn):
        gp.stiffiness = 0.55; gp.gravity_power = 0.25; gp.drag_force = 0.35; gp.hit_radius = 0.03
# ---- "Figure" shape key: fuller bust, hips, glutes, thighs (used per outfit at runtime, 0..1) ----
def figure_field(p):
    d = Vector((0, 0, 0)); fwd = -back
    for side in ('L', 'R'):
        c = bw('J_Sec_%s_Bust1' % side); c2 = bw('J_Sec_%s_Bust2' % side)
        cc = c * 0.4 + c2 * 0.6; r = P.get('bustr', 0.105); q = p - cc; dist = q.length
        if dist < r:
            wgt = (1 - (dist / r) ** 2) ** 2
            if q.dot(fwd) > -0.02:
                d += q * (P.get('bust', 0.22) * wgt) + fwd * (0.010 * wgt) + Vector((0, 0, 0.004 * wgt))
    zg = math.exp(-((p.z - (hipz - 0.03)) / 0.11) ** 2)
    if p.z < hipz + 0.14 and p.z > kneez:
        d += Vector((p.x * P.get('fhip', 0.12) * zg, 0, 0))                                 # wider hips
        gb = math.exp(-((p.z - gz) / 0.08) ** 2) * math.exp(-((abs(p.x) - 0.07) / 0.08) ** 2)
        if (p - Vector((p.x, 0, p.z))).dot(back) > -0.01: d += back * (P.get('fglute', 0.026) * gb)   # rounder glutes
    if kneez + 0.04 < p.z < hipz - 0.02:                                      # thighs
        ax = 0.085 if p.x > 0 else -0.085
        rv = Vector((p.x - ax, 0, 0)); rv.y = p.y - (hipC.y if 'hipC' in globals() else 0)
        fade = math.sin(min(1, (p.z - kneez - 0.04) / 0.25) * math.pi * 0.5)
        if rv.length > 1e-4: d += rv.normalized() * (0.009 * fade)
    return d
hipC = bw('J_Bip_C_Hips')
mwb = body.matrix_world; mwbi = mwb.inverted().to_3x3()
if not body.data.shape_keys: body.shape_key_add(name='Basis', from_mix=False)
fk = body.shape_key_add(name='Figure', from_mix=False)
moved = 0
for i, v in enumerate(body.data.vertices):
    d = figure_field(mwb @ v.co)
    if d.length > 1e-5: fk.data[i].co = v.co + mwbi @ d; moved += 1
print('FIGURE moved', moved)
meta = arm.data.vrm_addon_extension.vrm0.meta
meta.title = 'Rusana (ballbuster-anime)'; meta.author = 'BlaseFlat (edit of pixiv VRoid AvatarSample_B)'
bpy.ops.wm.save_as_mainfile(filepath=OUT.replace('.vrm', '.blend'))
res = bpy.ops.export_scene.vrm(filepath=OUT)
print('EXPORT', res, os.path.getsize(OUT))
