"""Rusana texture pass on VRoid AvatarSample_B textures (pixiv AvatarSample conditions: alteration allowed).
Input: textures dumped by tools/blender/inspect.py. Output: edited PNGs.
- crop top black -> burgundy, logo/straps text/necklace/tattoo removed
- briefs -> black fight shorts extended onto the thighs, with side slits
- garter/belt removed, hair purple -> dark brown-black, shoes -> white sneakers with burgundy accents
"""
import sys, os, numpy as np, cv2
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
P = dict(json=None)
S = float(os.environ.get('SHORTS', '0.62'))   # shorts length (fraction of 1024-preview leg column rows, see below)

def load(n): return np.asarray(Image.open(os.path.join(src, n)).convert('RGBA')).astype(np.float32)
def save(a, n): Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGBA').save(os.path.join(dst, n))
def hsv(a): return cv2.cvtColor(np.clip(a[..., :3], 0, 255).astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)

def skin_mask(a):
    h = hsv(a); H, Sa, V = h[..., 0] * 2, h[..., 1] / 255, h[..., 2] / 255
    return (H > 5) & (H < 40) & (Sa > 0.22) & (Sa < 0.75) & (V > 0.35)

def inpaint(a, mask, r=7):
    rgb = np.clip(a[..., :3], 0, 255).astype(np.uint8)
    out = cv2.inpaint(rgb, mask.astype(np.uint8) * 255, r, cv2.INPAINT_TELEA)
    b = a.copy(); b[..., :3] = out; return b

# ---------------- hair (all hair textures + face hairline) ----------------
def recolor_hair(a, only=None, hairlike=False):
    h = hsv(a); H, Sa, V = h[..., 0] * 2, h[..., 1] / 255, h[..., 2] / 255
    m = (((H > 160) & (H < 340) & (Sa > 0.06)) | ((Sa < 0.12) & (a[..., 3] > 0) & (V > 0.25) & hairlike)) if only is None else only
    # target: very dark brown-black with cool sheen; keep value structure
    v = np.clip(V * 0.55, 0, 1) ** 1.15
    base = np.stack([0.20 + 0.9 * v, 0.14 + 0.78 * v, 0.17 + 0.80 * v], -1) * 255 * (0.35 + 0.9 * v[..., None])
    out = a.copy(); out[m, :3] = base[m]
    return out
# ---------------- body ----------------
b = load('F00_000_00_Body_00.png'); Hh, Ww = b.shape[:2]; k = Ww / 1024
lum = b[..., :3].mean(-1) / 255
sk = skin_mask(b)
yy, xx = np.mgrid[0:Hh, 0:Ww] / k      # coordinates in 1024 space
center = (xx > 244) & (xx < 781)
side = ~center
# 1) necklace chain / star tattoo on skin above the top -> inpaint as skin
top_zone = center & (yy > 95) & (yy < 352)           # front/back torso rows that hold the crop top
neck_zone = center & (yy > 95) & (yy < 175)
h = hsv(b); sat = h[..., 1] / 255
chain = (neck_zone | (center & (yy < 352))) & ~sk & (sat < 0.25) & (lum > 0.3)   # grey chain over skin
tattoo = center & (yy > 120) & (yy < 190) & (sat > 0.45) & ~sk
strap_zone = side & (yy < 135)
# 2) crop top: every non-skin pixel in the torso band + strap/shoulder band becomes burgundy, shaded by original lum
sleeve = strap_zone & ~sk & (b[..., 3] > 10)
top = (top_zone & ~sk) & ~(center & (yy < 112))    # keep the choker row
_t = cv2.morphologyEx(top.astype(np.uint8), cv2.MORPH_OPEN, np.ones((int(5 * k), int(5 * k)), np.uint8))   # drop thin chain lines
_c = cv2.morphologyEx(_t, cv2.MORPH_CLOSE, np.ones((int(9 * k), int(9 * k)), np.uint8))
_ff = _c.copy(); _m = np.zeros((_ff.shape[0] + 2, _ff.shape[1] + 2), np.uint8); cv2.floodFill(_ff, _m, (int(600 * k), int(420 * k)), 1)
_t = _t | (1 - _ff)                                                                                 # fill logo holes
n, lab, stats, _ = cv2.connectedComponentsWithStats(_t)
keep = np.zeros(n, bool); keep[1:] = stats[1:, cv2.CC_STAT_AREA] > 4000 * k * k
top = (keep[lab] & top_zone & ~(center & (yy < 112))) | (center & (yy > 168) & (yy < 330) & (xx > 330) & (xx < 700))
# the "VROID" logo & text: inside top mask; we flatten luminance there
bur = np.array([112, 20, 40], np.float32)
shade = np.clip(np.minimum(lum, 0.13) / 0.13, 0.0, 1.0)
shade = cv2.GaussianBlur(shade, (0, 0), 14 * k)      # drop logo/text/chain detail, keep broad folds
flat = 0.78 + 0.35 * shade
top_rgb = bur[None, None, :] * flat[..., None]
# fabric folds from the original (dark top has subtle folds) - reuse high-pass of lum
lc = np.minimum(lum, 0.13); hp = cv2.medianBlur((lc*255).astype(np.uint8), 9).astype(np.float32)/255; hp = hp - cv2.GaussianBlur(hp, (0, 0), 4 * k)
hp[(yy > 160) & (yy < 300) & (xx > 360) & (xx < 680)] = 0
top_rgb += (np.clip(hp, -0.05, 0.05) * 600)[..., None] * np.array([1, 0.4, 0.5])
med = cv2.medianBlur(np.clip(b[..., :3], 0, 255).astype(np.uint8), int(21 * k) | 1).astype(np.float32)
odd = np.abs(b[..., :3] - med).sum(-1) > 45
deco = ((center & (yy > 112) & (yy < 260)) | (side & (yy > 80) & (yy < 140))) & odd & ~top
deco = cv2.dilate(deco.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool) & ~top
smudge = center & (yy > 112) & (yy < 240) & ~top & (lum < 0.42)
smudge = cv2.dilate(smudge.astype(np.uint8), np.ones((7, 7), np.uint8)).astype(bool) & ~top
sleeve = cv2.dilate(sleeve.astype(np.uint8), np.ones((9, 9), np.uint8)).astype(bool)
fillm = ((chain | tattoo | deco | smudge) & ~top) | sleeve
fillm = cv2.dilate(fillm.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool) & ~top & ~(center & (yy < 104))
good = (sk & ~fillm).astype(np.float32)
def skin_fill(img, good, sig):
    num = cv2.GaussianBlur(img[..., :3] * good[..., None], (0, 0), sig)
    den = cv2.GaussianBlur(good, (0, 0), sig)[..., None]
    return num / np.maximum(den, 1e-4), den[..., 0]
f1, d1 = skin_fill(b, good, 6 * k); f2, d2 = skin_fill(b, good, 22 * k)
fill = np.where((d1 > 0.08)[..., None], f1, f2)
neckz = center & (yy > 104) & (yy < 200) & ~top
fill = np.where(neckz[..., None], f2, fill)
orig_hp = b[..., :3] - cv2.GaussianBlur(b[..., :3], (0, 0), 4 * k)
sat_hi = cv2.dilate(((hsv(b)[..., 1] / 255 > 0.5) | odd).astype(np.uint8), np.ones((int(9 * k), int(9 * k)), np.uint8)).astype(bool)
fill = np.where((neckz & sk & ~fillm & ~sat_hi)[..., None], fill + np.clip(orig_hp, -40, 25), fill)
fillm = fillm | neckz
# hands share UV space with the torso band: keep them skin (mask from hand_uv_mask.mjs)
_hm = os.environ.get('HAND_MASK')
if _hm and os.path.exists(_hm):
    handm = cv2.resize((np.asarray(Image.open(_hm).convert('L')) > 0).astype(np.uint8), (Ww, Hh), interpolation=cv2.INTER_NEAREST)
    handm = cv2.dilate(handm, np.ones((int(5 * k), int(5 * k)), np.uint8)).astype(bool) & (yy < 460)
    top = top & ~handm
    fillm = fillm | (handm & center)
b2 = b.copy()
b2[fillm, :3] = fill[fillm]
# feather: soften the seam around filled regions
fe = cv2.GaussianBlur(fillm.astype(np.float32), (0, 0), 3 * k)[..., None]
b2[..., :3] = b2[..., :3] * (1 - fe * 0.0) + 0
b2[top, :3] = top_rgb[top]
# hem: thin darker line at the bottom edge of the top
topm = top.astype(np.uint8)
er = cv2.erode(topm, np.ones((int(5 * k), int(5 * k)), np.uint8))
edge = (topm - er).astype(bool) & center
b2[edge, :3] = bur * 0.55
# 3) shorts: dark pixels in the hip band + extension down the thighs (side columns)
hip = center & (yy > 470) & (yy < 660) & (lum < 0.35) & ~sk
# garter belt on the thigh -> skin
belt = side & (yy > 560) & (yy < 640) & ~sk
b2 = inpaint(b2, belt, 11)
leg_top = 515
leg_len = 62 + 60 * S
legs = side & (yy > leg_top - 8) & (yy < leg_top + leg_len)
# side slit: small notch where the column wraps (column edges = outer thigh seam)
colx = np.where(xx < 245, xx / 244, (xx - 781) / 243)
slit_c = np.where(xx < 245, 0.0, 1.0)     # guessed outer seam at column edge
d_edge = np.minimum(colx, 1 - colx)
slit = legs & (d_edge < 0.06) & (yy > leg_top + leg_len - 28)
shorts = (hip | legs)   # (side slit dropped: it landed on the back seam)
blk = np.array([24, 23, 28], np.float32)
sh_shade = cv2.GaussianBlur(np.clip(lum / 0.2, 0, 1), (0, 0), 5 * k)
b2[shorts, :3] = (blk[None, None] * (0.85 + 0.5 * sh_shade[..., None]))[shorts]
# hem + trim stripe (burgundy) on the shorts
sm = shorts.astype(np.uint8)
er = cv2.erode(sm, np.ones((int(7 * k), int(7 * k)), np.uint8))
hem = (sm - er).astype(bool) & side & (yy > leg_top + 20)
b2[hem, :3] = bur
b2[..., 3] = np.where(shorts | top, 255, b2[..., 3])
b2 = recolor_hair(b2)
nails = (yy > 805) & (lum < 0.25) & ((np.abs(xx - 336) < 15) | (np.abs(xx - 687) < 15))
nh = hsv(b2)[..., 2] / 255
# (nail tint dropped: it bled onto the back of the hands)
# hair-tie colour lives on a hidden scalp texel (see build_rusana.py)
cv2.circle(b2, (int(0.5 * Ww), int(0.87 * Hh)), int(18 * k), (112, 20, 40, 255), -1)
save(b2, 'F00_000_00_Body_00.png')
# outfit mask for runtime outfit swaps (js/outfits.js): R = top, G = shorts, B = trim (hems), 1024 px
om = np.zeros((Hh, Ww, 4), np.float32); om[..., 3] = 255
om[..., 0] = top * 255; om[..., 1] = shorts * 255; om[..., 2] = (edge | hem) * 255
om[hem | edge, 0] = 0; om[hem | edge, 1] = 0
Image.fromarray(om.astype(np.uint8), 'RGBA').convert('RGB').resize((1024, 1024), Image.NEAREST).save(os.path.join(dst, 'outfit_mask.png'))

for i in range(1, 7):
    n = f'F00_000_Hair_00_0{i}.png'
    if not os.path.exists(os.path.join(src, n)): continue
    save(recolor_hair(load(n)), n)
f = load('F00_000_00_Face_00.png')
f = recolor_hair(f)
save(f, 'F00_000_00_Face_00.png')

# ---------------- shoes: black upper -> white, blue accents -> burgundy, remove text ----------------
s = load('F00_006_01_Shoes_01.png')
h = hsv(s); H, Sa, V = h[..., 0] * 2, h[..., 1] / 255, h[..., 2] / 255
dark = (V < 0.45) & (s[..., 3] > 0)
blue = (H > 170) & (H < 230) & (Sa > 0.4)
s2 = s.copy()
w = 0.80 + 0.45 * np.clip(V / 0.45, 0, 1)
s2[dark, :3] = (np.stack([w * 235, w * 234, w * 238], -1))[dark]
s2[blue, :3] = (bur[None, None] * (0.8 + 0.5 * V[..., None]))[blue]
# text stripes: light-on-dark bands became white; flatten any remaining high-contrast black pixels near text
save(s2, 'F00_006_01_Shoes_01.png')

# ---------------- iris: gold -> dark amber (colder look) ----------------
e = load('F00_000_00_EyeIris_00.png')
h = hsv(e); V = h[..., 2] / 255
m = e[..., 3] > 0
amber = np.stack([0.50 + 0.40 * V, 0.20 + 0.26 * V, 0.13 + 0.14 * V], -1) * 255 * (0.30 + 0.75 * V[..., None])
e[m, :3] = amber[m]
save(e, 'F00_000_00_EyeIris_00.png')
for n in ('F00_000_00_FaceEyeline_00.png', 'F00_000_00_FaceBrow_00.png', 'F00_000_00_FaceEyelash_00.png'):
    a = load(n); hh = hsv(a); vv = hh[..., 2] / 255; m = a[..., 3] > 0
    a[m, :3] = (np.stack([0.30 + 0.5 * vv, 0.18 + 0.4 * vv, 0.18 + 0.4 * vv], -1) * 255 * (0.25 + 0.6 * vv[..., None]))[m]
    save(a, n)
hl = load('F00_000_00_EyeHighlight_00.png'); hl[..., 3] *= 0.75; save(hl, 'F00_000_00_EyeHighlight_00.png')
print('ok')
