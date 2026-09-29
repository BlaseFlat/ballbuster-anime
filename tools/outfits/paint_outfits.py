"""Paint Rusana's outfit textures by 3D rules on her Body UV layout.
python3 paint_outfits.py <rus_tex dir> <uvmaps dir> <out dir> [ids...]
Every garment is a region predicate over bind-pose position (x: character-right-to-left, y up, z: front<0) and body part,
so hems are straight 3D lines that match across UV seams. Outputs <id>.jpg (Body map) + <id>_gloss.png (latex/leather mask).
All outfits keep bust and groin covered (non-explicit)."""
import sys, os, json, math, numpy as np, cv2
from PIL import Image
rt, uvd, out = sys.argv[1], sys.argv[2], sys.argv[3]; only = set(sys.argv[4:])
os.makedirs(out, exist_ok=True)
S = 2048
pos = np.fromfile(f'{uvd}/pos.f32', np.float32).reshape(S, S, 3); nrm = np.fromfile(f'{uvd}/nrm.f32', np.float32).reshape(S, S, 3)
part = np.fromfile(f'{uvd}/part.u8', np.uint8).reshape(S, S); J = json.load(open(f'{uvd}/joints.json'))
X, Y, Z = pos[..., 0], pos[..., 1], pos[..., 2]; NX, NY, NZ = nrm[..., 0], nrm[..., 1], nrm[..., 2]
valid = part > 0
HEAD, CHEST, SPINE, HIPS, UARM, LARM, HAND, ULEG, LLEG, FOOT = range(1, 11)
isp = lambda *ps: np.isin(part, ps)
TORSO = isp(CHEST, SPINE, HIPS); LEG = isp(ULEG, LLEG); ARM = isp(UARM, LARM)
AX = abs(X)
# landmarks (m)
BUST = J['J_Sec_L_Bust1'][1] + 0.01; UNDER = BUST - 0.065; WAIST = 0.985; NAVEL = 0.95; HIPY = 0.895; CROTCH = 0.79
KNEE = J['J_Bip_L_LowerLeg'][1]; ANKLE = 0.14; NECK = 1.235
fb = np.clip((Z + 0.03) / 0.08, 0, 1)                      # 0 = front of torso, 1 = back
# leg cylindrical coordinates (arc length around the leg axis)
def leg_axis(y):
    y0, y1, y2 = J['J_Bip_L_UpperLeg'][1], KNEE, J['J_Bip_L_Foot'][1]
    x0, x1, x2 = abs(J['J_Bip_L_UpperLeg'][0]), abs(J['J_Bip_L_LowerLeg'][0]), abs(J['J_Bip_L_Foot'][0])
    return np.where(y > y1, x1 + (x0 - x1) * (y - y1) / (y0 - y1), x2 + (x1 - x2) * (y - y2) / (y1 - y2))
LAX = leg_axis(Y); LANG = np.arctan2(Z, AX - LAX)       # 0 = outer side, ±pi = inner side, -pi/2 = front
ARC = LANG * 0.055

# ---------- base textures ----------
def load(p, size=S): return np.asarray(Image.open(p).convert('RGB').resize((size, size), Image.LANCZOS)).astype(np.float32)
default = load(f'{rt}/F00_000_00_Body_00.png')
om = np.asarray(Image.open(f'{rt}/outfit_mask.png').convert('RGB').resize((S, S), Image.NEAREST)) > 127
cloth_def = om.any(-1)
h_, s_, v_ = [np.asarray(c, np.float32) for c in cv2.split(cv2.cvtColor(default.astype(np.uint8), cv2.COLOR_RGB2HSV))]
burg = ((h_ > 160) | (h_ < 6)) & (s_ > 110) & (v_ < 190) & isp(CHEST, SPINE, UARM, HIPS, HEAD) & (Y < NECK - 0.02)   # straps of the default top
cloth_def |= burg
cloth_def = cv2.dilate(cloth_def.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool) & (TORSO | LEG | ARM | isp(HEAD))
hsvd = cv2.cvtColor(default.astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
skin_px = valid & ~cloth_def & (hsvd[..., 1] > 50) & (hsvd[..., 1] < 190) & (hsvd[..., 2] > 90) & isp(CHEST, SPINE, HIPS, ULEG, LLEG, UARM)
def nconv(img, good, sig):
    num = cv2.GaussianBlur(img * good[..., None], (0, 0), sig); den = cv2.GaussianBlur(good.astype(np.float32), (0, 0), sig)[..., None]
    return num / np.maximum(den, 1e-4), den[..., 0]
f1, d1 = nconv(default, skin_px.astype(np.float32), 12); f2, _ = nconv(default, skin_px.astype(np.float32), 60)
skinfill = np.where((d1 > 0.1)[..., None], f1, f2)
# gentle anatomical shading on filled skin (from normals) so it isn't dead flat
shade = (0.95 + 0.05 * np.clip(NY * 0.5 + 0.5, 0, 1))[..., None]
SKIN = default.copy(); SKIN[cloth_def] = (skinfill * shade)[cloth_def]
SKIN = cv2.GaussianBlur(SKIN, (0, 0), 1.2) * cloth_def[..., None] + SKIN * (~cloth_def)[..., None]
TIE = (int(0.5 * S), int(0.87 * S))

rng = np.random.default_rng(3)
NOISE = cv2.GaussianBlur(rng.normal(0, 1, (S, S)).astype(np.float32), (0, 0), 1.0)
C = lambda h: np.array([(h >> 16) & 255, (h >> 8) & 255, h & 255], np.float32)

# modesty zones: no pin-point gloss/shine on the bust apex or the crotch front (keeps glossy outfits non-explicit)
_b1 = J['J_Sec_L_Bust2']; _ax = abs(_b1[0]) + 0.004
MOD = np.zeros((S, S), np.float32)
for sg in (-1, 1):
    d2 = (X - sg * _ax) ** 2 + (Y - (_b1[1] - 0.004)) ** 2 + np.minimum(0, Z - (_b1[2] - 0.01)) ** 2
    MOD = np.maximum(MOD, np.exp(-d2 / (2 * 0.028 ** 2)) * isp(CHEST))
cz = np.exp(-(AX / 0.05) ** 2) * np.exp(-((Y - (CROTCH + 0.02)) / 0.05) ** 2) * (Z < 0.02) * isp(HIPS, ULEG, SPINE)
MOD = np.clip(np.maximum(MOD, cz) * 1.4, 0, 1)
_d, _lab = cv2.distanceTransformWithLabels((~valid).astype(np.uint8), cv2.DIST_L2, 5, labelType=cv2.DIST_LABEL_PIXEL)
_zy, _zx = np.nonzero(valid)                      # label k (1-based) = k-th zero pixel in row-major order
_li = np.clip(_lab - 1, 0, len(_zy) - 1)
PAD_IDX = (_zy[_li], _zx[_li]); PAD_SRC = (~valid) & (_d < 24) & ~isp(HEAD)
PAD_SRC[int(0.87 * S) - 40:int(0.87 * S) + 40, S // 2 - 40:S // 2 + 40] = False
class Painter:
    def __init__(s, base=None): s.img = (SKIN if base is None else base).copy(); s.gloss = np.zeros((S, S), np.float32); s.cover = np.zeros((S, S), bool)
    def fill(s, m, col, gloss=0.0, grain=4.0, shine=0.0, tex=None):
        m = m & valid; c = C(col) if isinstance(col, int) else col
        lit = (0.9 + 0.1 * np.clip(NY * 0.6 + 0.4 - NZ * 0.2, 0, 1))[..., None]
        v = c * lit + (NOISE * grain)[..., None]
        if shine: v = v + shine * 255 * ((np.clip(-NZ, 0, 1) ** 6) * (1 - MOD))[..., None] * (0.6 + 0.4 * np.clip(NY + 0.5, 0, 1))[..., None]
        if tex is not None: v = tex(v)
        s.img[m] = v[m]; s.gloss[m] = gloss; s.cover |= m
    def line(s, m, col, gloss=None):
        m = m & valid; s.img[m] = C(col); 
        if gloss is not None: s.gloss[m] = gloss
    def mix(s, m, col, a):
        m = m & valid; s.img[m] = s.img[m] * (1 - a) + C(col) * a
    def save(s, name, tie=0x701428, shoes=None):
        img = s.img.copy()
        # pad every UV island outward (nearest valid texel) so bilinear/mip sampling at seams never picks up
        # leftovers of the default outfit (burgundy) from unused texels
        img[PAD_SRC] = img[PAD_IDX[0], PAD_IDX[1]][PAD_SRC]
        s.gloss[PAD_SRC] = s.gloss[PAD_IDX[0], PAD_IDX[1]][PAD_SRC]
        cv2.circle(img, TIE, 36, C(tie).tolist(), -1)
        Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(f'{out}/{name}.jpg', quality=88, optimize=True)
        g = cv2.resize(s.gloss * (1 - MOD), (512, 512), interpolation=cv2.INTER_AREA)
        g = 0.4 + 0.6 * g   # skin keeps 40% of the (boosted x2.2) anime rim; garments get rim + matcap sheen
        Image.fromarray((np.clip(g, 0, 1) * 255).astype(np.uint8)).save(f'{out}/{name}_gloss.png', optimize=True)
        print('saved', name, 'gloss' if s.gloss.max() > 0 else '')

band = lambda m, y, w=0.006: m & (np.abs(Y - y) < w)
# ---------- reusable garments ----------
BODY_OK = valid & ~isp(HAND, FOOT)
ARMS = isp(UARM, LARM) & (AX > 0.12)      # arm texels; the shoulder/armpit transition belongs to torso rules (smooth edges)
smooth = lambda e0, e1, v: np.clip((v - e0) / (e1 - e0), 0, 1) ** 2 * (3 - 2 * np.clip((v - e0) / (e1 - e0), 0, 1))
def top_region(y_top_front, y_top_back, y_bot, straps=0.0, halter=False, back_open=False):
    ytop = y_top_front + (y_top_back - y_top_front) * fb
    m = BODY_OK & ~ARMS & ~isp(LLEG) & (Y < ytop) & (Y > y_bot)
    if straps:
        sx = 0.075 if not halter else 0.03 + 0.045 * np.clip((NECK - Y) / 0.12, 0, 1)
        st = BODY_OK & ~ARMS & (Y >= ytop - 0.01) & (Y < NECK + 0.005) & (np.abs(AX - sx) < straps)
        if halter: st &= fb < 0.5
        m |= st
    if back_open: m &= ~((fb > 0.8) & (Y > y_bot + 0.02) & (Y < ytop - 0.02) & (AX < 0.05))
    return m
def bottoms_region(y_waist, leg_len_front, leg_len_back=None, highcut=0.0):
    """Briefs/shorts: from y_waist down to a smooth leg opening. highcut raises the opening toward the hip bone
    (front fully, back half — a cheeky cut)."""
    lb = leg_len_front if leg_len_back is None else leg_len_back
    back = smooth(-0.03, 0.05, Z)
    s = smooth(0.03, 0.125, AX)
    hem = (leg_len_front + highcut * s) * (1 - back) + (lb + 0.5 * highcut * s) * back
    return BODY_OK & ~ARMS & ~isp(LLEG) & (Y < y_waist) & (Y > hem)
def leg_region(y_top, y_bot=ANKLE):
    return LEG & (Y < y_top) & (Y > y_bot)

def footwear_sandals(p, col=0xfff1e6, strap=0xff5d8f):
    """Flat sandals: pale sole covering FOOT + pink straps (beach). Visible once Shoes mesh is hidden."""
    foot = isp(FOOT)
    # full foot coverage so default sock/sneaker paint is gone
    p.fill(foot, col, grain=3)
    # darker sole underside
    p.fill(foot & (Y < 0.04), 0xe8d4c4, grain=2)
    # toe bar + ankle strap + side connector
    p.fill(foot & (np.abs(Y - 0.055) < 0.01) & (Z < 0.025), strap, grain=2)
    p.fill(foot & (np.abs(Y - 0.095) < 0.008), strap, grain=2)
    p.line(LEG & (Y < ANKLE + 0.025) & (Y > ANKLE - 0.005), strap)

def footwear_heels(p, col=0x151116, shaft=0.0, gloss=0.75):
    """Stiletto / pump painted on FOOT (+ optional short shaft up ankle)."""
    foot = isp(FOOT)
    # shoe body covering foot top + sole
    shoe = foot | (LEG & (Y < ANKLE + 0.01 + shaft) & (Y > 0.02))
    p.fill(shoe, col, gloss=gloss, shine=0.12, grain=2)
    # darker sole edge
    p.line(foot & (Y < 0.035) & (np.abs(NZ) > 0.3), max(0, col - 0x101010) if isinstance(col, int) else col)
    # thin heel bar suggestion on back of foot
    p.fill(foot & (Z > 0.01) & (Y < 0.08) & (AX < 0.03), col, gloss=gloss)

def fishnet(v, cell=0.011, width=0.0013, col=(18, 16, 20)):
    u1 = (ARC + Y) / cell; u2 = (ARC - Y) / cell
    d = np.minimum(np.abs(u1 - np.round(u1)), np.abs(u2 - np.round(u2))) * cell
    a = np.clip(1 - (d - width) / 0.0007, 0, 1)[..., None]
    return v * (1 - a) + np.array(col, np.float32) * a
def sheer(base_img, col, a):
    return base_img * (1 - a) + C(col) * a

# ---------- outfits ----------
OUT = {}
def outfit(fn): OUT[fn.__name__] = fn; return fn

@outfit
def fitness():
    p = Painter()
    bra = top_region(BUST + 0.055, BUST + 0.02, UNDER - 0.012, straps=0.018)
    p.fill(bra, 0x1f2a36, grain=3)
    p.line(band(bra, UNDER - 0.012 + 0.008, 0.008), 0x33d1c4)          # elastic band
    legg = bottoms_region(WAIST - 0.02, 0.5) | leg_region(0.92, ANKLE + 0.02)
    p.fill(legg, 0x16181f, grain=3, shine=0.05)
    p.line(legg & (np.abs(LANG) < 0.09) & (Y < WAIST - 0.03), 0x33d1c4)   # side stripes
    p.line(band(legg, WAIST - 0.02 - 0.01, 0.01), 0x2b3240)
    return p, dict(shoes=0xf2f2f2)

@outfit
def bandeau():
    p = Painter()
    top = top_region(BUST + 0.045, BUST + 0.03, UNDER + 0.005)
    p.fill(top, 0xf7f3f0, grain=5)
    for k in range(3): p.line(band(top, UNDER + 0.018 + k * 0.022, 0.0012), 0xe9b5c6)   # ribbing
    def denim(v): return v * (0.85 + 0.25 * np.clip(0.5 + NOISE[..., None] * 0.18, 0, 1))
    sh = bottoms_region(NAVEL - 0.03, CROTCH - 0.015, CROTCH - 0.03)
    p.fill(sh, 0x5c7fb5, grain=10, tex=denim)
    hemm = sh & (Y < CROTCH + 0.0) & LEG
    p.fill(hemm & (Y < CROTCH - 0.005), 0x8fb0d8, grain=16)             # frayed hem
    p.line(band(sh, NAVEL - 0.03 - 0.006, 0.006), 0x3e5c8c)            # waistband
    p.line(sh & (np.abs(X) < 0.0025) & (fb < 0.3) & (Y > CROTCH + 0.02), 0xd9a441)   # fly stitch
    return p, dict(shoes=0xfbe2ea)

@outfit
def varsity():
    p = Painter()
    tube = top_region(BUST + 0.05, BUST + 0.04, UNDER - 0.005)
    p.fill(tube, 0x17151c, grain=3)
    p.line(band(tube, BUST + 0.05 - 0.006 + (0.04 - 0.05) * 0, 0.004), 0xe8e8ee)
    br = bottoms_region(HIPY - 0.01, CROTCH - 0.005)                    # under-skirt briefs
    p.fill(br, 0x17151c)
    socks = leg_region(KNEE - 0.04, 0.02)
    p.fill(socks, 0xf4f2ee, grain=3)
    for k in range(2): p.line(band(socks, KNEE - 0.075 - k * 0.02, 0.005), 0x23203a)
    return p, dict(shoes=0x2a2438, meshes={'jacket': 'crop', 'skirt': 0xf0a3bd})

@outfit
def fishnet_street():
    p = Painter()
    top = top_region(BUST + 0.05, BUST + 0.035, UNDER - 0.0, straps=0.006)
    p.fill(top, 0x121015, grain=3, gloss=0.35, shine=0.06)
    for dy in (0.015, 0.035): p.line(band(top, UNDER + dy, 0.0025), 0x3a3540)   # strappy criss-cross
    net = leg_region(0.93, ANKLE) | bottoms_region(0.93, 0.5)
    base = p.img.copy(); p.img[net] = fishnet(base)[net]
    sh = bottoms_region(HIPY + 0.005, CROTCH - 0.012, CROTCH - 0.025)
    p.fill(sh, 0x141217, gloss=0.6, shine=0.12)
    p.line(band(sh, HIPY + 0.005 - 0.006, 0.005), 0xb8b8c4, gloss=0.8)   # studded belt
    return p, dict(shoes=0x141217)

@outfit
def beach():
    p = Painter()
    # triangle bikini: two triangles centred under each bust apex + string ties
    bx = abs(J['J_Sec_L_Bust1'][0]) + 0.012
    for sgn in (-1, 1):
        dx = X - sgn * bx; h = (BUST + 0.05) - Y
        tri = isp(CHEST) & (fb < 0.55) & (Y < BUST + 0.05) & (Y > UNDER - 0.004) & (np.abs(dx) < 0.012 + h * 0.62)
        p.fill(tri, 0xff5d8f, grain=4)
    p.line(isp(CHEST) & band(Y > 0, UNDER, 0.004) & (fb > 0.2) & (Y > 0), 0xff5d8f)                      # back string
    p.line(isp(CHEST, HEAD) & (np.abs(AX - (bx - 0.005 + 0.03 * np.clip((Y - BUST - 0.05) / 0.12, 0, 1))) < 0.0035) & (Y > BUST + 0.045) & (Y < NECK + 0.01) & (fb < 0.6), 0xff5d8f)  # halter string
    bot = bottoms_region(HIPY - 0.02, CROTCH - 0.006, CROTCH - 0.02, highcut=0.085)
    p.fill(bot, 0xff5d8f, grain=4)
    p.line(band(bot, HIPY - 0.02 - 0.004, 0.004), 0xffd1df)
    p.line(isp(HIPS, SPINE) & band(Y > 0, HIPY - 0.023, 0.0035) & (Y > 0), 0xff5d8f)      # side ties
    footwear_sandals(p, 0xfff1e6, 0xff5d8f)
    return p, dict(shoes=0xfff1e6, tie=0xff5d8f, hideShoes=True)

@outfit
def bodycon():
    # fitted strapless bodice (painted) + flared mini skirt (the skirt mesh, tinted red at runtime)
    p = Painter()
    dress = top_region(BUST + 0.045, BUST + 0.02, HIPY) | bottoms_region(HIPY + 0.01, CROTCH - 0.01)
    p.fill(dress, 0xc8102e, gloss=0.5, grain=3, shine=0.1)
    for dy in np.arange(0.0, 0.2, 0.03): p.mix(band(dress & TORSO, WAIST - 0.06 + dy, 0.0015) & (Y < UNDER - 0.01), 0x8e0b22, 0.5)   # ruching
    p.line(band(dress, BUST + 0.045 - 0.004, 0.004) & (fb < 0.5), 0x7e0a1d)
    p.line(band(dress, WAIST, 0.004), 0x1a1016, gloss=0.8)          # thin black belt
    footwear_heels(p, 0xc8102e, shaft=0.02, gloss=0.55)
    return p, dict(shoes=0xc8102e, tie=0xc8102e, figure=0.85, hideShoes=True, meshes={'skirt': 0xc8102e})

@outfit
def biker():
    p = Painter()
    top = top_region(BUST + 0.06, BUST + 0.01, UNDER - 0.005, straps=0.02, halter=True)
    p.fill(top, 0x1b1718, gloss=0.55, shine=0.12)
    p.line(top & (np.abs(X) < 0.003) & (fb < 0.4), 0xb9b9c0, gloss=1)      # zip
    hp = bottoms_region(HIPY - 0.005, CROTCH - 0.01, CROTCH - 0.022)
    p.fill(hp, 0x1b1718, gloss=0.55, shine=0.12)
    p.line(band(hp, HIPY - 0.011, 0.005), 0x5a2d1e, gloss=0.3)             # belt
    boots = leg_region(KNEE + 0.13, 0.0) | isp(FOOT)
    p.fill(boots, 0x151213, gloss=0.7, shine=0.15)
    p.line(boots & band(Y > 0, KNEE + 0.125, 0.005), 0x3a3336)
    p.line(boots & (np.abs(LANG) < 0.035) & (Y > ANKLE), 0xb9b9c0, gloss=1)   # side zips
    return p, dict(shoes=0x151213, tie=0x1b1718, hideShoes=True)

@outfit
def corset():
    p = Painter()
    cor = top_region(BUST + 0.05, BUST - 0.01, HIPY + 0.01, straps=0.0)
    p.fill(cor, 0x5a0d1f, gloss=0.3, shine=0.08, grain=3)
    for bx in (0.03, 0.06, 0.09, 0.115): p.line(cor & (np.abs(AX - bx) < 0.0018) & (Y < BUST - 0.01), 0x2b0610)      # boning
    lace = cor & (fb < 0.3) & (AX < 0.018) & (Y < BUST - 0.005)
    p.fill(lace, 0x1a0a0e)
    ph = np.abs(((Y * 60) % 1) - 0.5) * 2
    p.line(lace & (np.abs(AX - ph * 0.016) < 0.0022), 0xe7d3c0)                 # criss-cross lacing
    p.line(band(cor, BUST + 0.05 - 0.004 + (-0.06) * fb, 0.005), 0x1a0a0e)       # lace trim top
    br = bottoms_region(HIPY, CROTCH - 0.005); p.fill(br, 0x16121a)
    st = leg_region(KNEE + 0.16, ANKLE - 0.01)
    p.img[st & valid] = sheer(p.img, 0x0c0a10, 0.62)[st & valid]
    lt = st & (Y > KNEE + 0.12)
    p.fill(lt, 0x151116, grain=6)
    p.line(lt & (np.abs(((ARC / 0.012) % 1) - 0.5) < 0.18) & (Y > KNEE + 0.145), 0x3d3440)   # lace scallops
    p.line(ULEG & (np.abs(LANG + math.pi / 2) < 0.03) & (Y > KNEE + 0.15) & (Y < HIPY), 0x16121a)  # garter straps
    footwear_heels(p, 0x151116, shaft=0.025, gloss=0.7)
    return p, dict(shoes=0x151116, tie=0x5a0d1f, figure=0.7, hideShoes=True, meshes={'skirt': 0x1b1820})

@outfit
def latex():
    p = Painter()
    suit = valid & ~isp(HAND, FOOT) & (Y < NECK - 0.02) & (Y > ANKLE - 0.02)
    suit &= ~(isp(LARM) & (AX > abs(J['J_Bip_L_Hand'][0]) - 0.015))
    p.fill(suit, 0x0d0c10, gloss=1.0, grain=1.5, shine=0.22)
    p.line(suit & (np.abs(X) < 0.0028) & (fb < 0.25) & (Y > WAIST - 0.04) & (Y < NECK), 0xa7a7b2, gloss=1)
    p.line(suit & (np.abs(X) < 0.006) & (fb < 0.25) & (np.abs(Y - (WAIST - 0.045)) < 0.008), 0xc9c9d2, gloss=1)   # zip pull   # front zip
    p.line(band(suit, NECK - 0.012, 0.005), 0x2a2830, gloss=0.6)
    footwear_heels(p, 0x0d0c10, shaft=0.03, gloss=1.0)
    return p, dict(shoes=0x0d0c10, tie=0x0d0c10, figure=1.0, hideShoes=True)

@outfit
def champion():
    p = Painter()
    leo = (top_region(BUST + 0.055, BUST + 0.05, HIPY, straps=0.014, halter=True, back_open=True) | bottoms_region(HIPY + 0.01, CROTCH - 0.004, CROTCH - 0.02, highcut=0.13))
    p.fill(leo, 0x121015, gloss=0.9, shine=0.18, grain=2)
    gold = 0xe0b23a
    p.line(band(leo, BUST + 0.055 - 0.004 + (0.05 - 0.055) * fb, 0.004), gold, gloss=1)
    p.line(leo & (np.abs(X) < 0.004) & (fb < 0.3) & (Y > WAIST - 0.02) & (Y < UNDER), gold, gloss=1)
    p.line(band(leo, WAIST, 0.005) & (fb < 0.5), gold, gloss=1)
    boots = leg_region(KNEE + 0.17, 0.0) | isp(FOOT)
    p.fill(boots, 0x121015, gloss=0.9, shine=0.18)
    p.line(boots & band(Y > 0, KNEE + 0.165, 0.006), gold, gloss=1)
    gl = isp(LARM) & (AX > 0.36)
    p.fill(gl, 0x121015, gloss=0.9, shine=0.15)
    p.line(gl & (np.abs(AX - 0.365) < 0.004), gold, gloss=1)
    return p, dict(shoes=0x121015, tie=gold, figure=1.0, hideShoes=True)

for name, fn in OUT.items():
    if only and name not in only: continue
    p, meta = fn()
    p.save(name, tie=meta.get('tie', 0x701428))
    json.dump(meta, open(f'{out}/{name}.json', 'w'))
# skin base for reference/debug
Image.fromarray(np.clip(SKIN, 0, 255).astype(np.uint8)).resize((1024, 1024)).save(f'{out}/_skin_preview.jpg', quality=80)
