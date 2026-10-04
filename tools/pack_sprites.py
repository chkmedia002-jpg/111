"""把 art/src/ 裡的美術圖處理成遊戲用的精靈資料:python3 tools/pack_sprites.py

- 自動去背(透明背景直接使用;純綠 #00FF00 或純白背景會被去除)
- 裁切到主體範圍,找出腳底(底部像素的中心)當作錨點
- 依類型縮放,輸出 js/sprites_data.js(base64 內嵌,單一 HTML 也能用)
- 動畫:`代號_狀態_01.png`、`代號_狀態_02.png`…(狀態:idle / walk / attack / death)
  或一張橫向排列的精靈圖表 `代號_狀態.png`(格子之間留透明空隙,會自動切開)。
  同一組畫格使用共同的裁切框,保留原圖的相對位置,避免播放時抖動。
"""
import re
import base64, io, json, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'art', 'src')
OUT = os.path.join(ROOT, 'js', 'sprites_data.js')

# 遊戲中的顯示高度(邏輯像素,從圖的最高點到腳底)。可在檔名對應的條目調整。
HEIGHT = {'inf': 21, 'inf2': 22, 'light': 30, 'tank': 26, 'art': 28, 'harvester': 24, 'engineer': 19}
OVERRIDE = {}          # 例:{'jp_inf2': 24}
# 沒有靜態圖時,指定用哪一格當站立(待命)姿勢:(狀態, 第幾格,從 1 開始)
STAND_FRAME = {'jp_inf2': ('walk', 3)}
PIXELS_PER_UNIT = 12   # 最大縮放時每個邏輯像素對應的圖片像素


def remove_bg(im):
    im = im.convert('RGBA')
    px = im.load()
    w, h = im.size
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    if all(c[3] < 10 for c in corners):
        return im
    bg = corners[0][:3]
    # 從邊緣開始填色去背,避免挖掉主體內相近的顏色
    from collections import deque
    tol = 60 if bg[1] > 200 and bg[0] < 80 else 18
    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        r, g, b, a = px[x, y]
        if abs(r - bg[0]) + abs(g - bg[1]) + abs(b - bg[2]) > tol * 3:
            continue
        px[x, y] = (r, g, b, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                q.append((nx, ny))
    return im


def process(path, code):
    im = remove_bg(Image.open(path))
    bbox = im.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox()
    im = im.crop(bbox)
    w, h = im.size
    a = im.getchannel('A').load()
    # 腳底錨點:最下方 4% 高度內不透明像素的水平中心
    ys = range(int(h * 0.96), h)
    xs = [x for y in ys for x in range(w) if a[x, y] > 128]
    ax = sum(xs) / len(xs) if xs else w / 2
    kind = code.split('_', 1)[1] if '_' in code else code
    H = OVERRIDE.get(code, HEIGHT.get(kind, 22))
    scale = H * PIXELS_PER_UNIT / h
    out = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    buf = io.BytesIO()
    out.save(buf, 'WEBP', quality=88, method=6)
    lw, lh = w * H / h, H
    return {'src': 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode(),
            'w': round(lw, 2), 'h': round(lh, 2), 'ax': round(ax * H / h, 2), 'ay': round(lh, 2)}, len(buf.getvalue())


STATES = ('idle', 'walk', 'attack', 'death')
FPS = {'idle': 2, 'walk': 0, 'attack': 0, 'death': 4}   # walk 依移動距離換格,attack 依攻擊冷卻換格


def split_sheet(im):
    """把橫向精靈圖表依透明的直欄空隙切成多格"""
    a = im.getchannel('A').point(lambda v: 255 if v > 24 else 0)
    w, h = im.size
    col = [a.crop((x, 0, x + 1, h)).getbbox() is not None for x in range(w)]
    frames, start = [], None
    for x, filled in enumerate(col + [False]):
        if filled and start is None:
            start = x
        elif not filled and start is not None:
            if x - start > w * 0.04:
                frames.append(im.crop((start, 0, x, h)))
            start = None
    return frames


def encode(im, scale):
    out = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    buf = io.BytesIO()
    out.save(buf, 'WEBP', quality=88, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode(), len(buf.getvalue())


def process_anim(code, state, frames):
    frames = [remove_bg(f) for f in frames]
    # 若畫格尺寸不同(來自精靈圖表),先置中到同樣大小的畫布,底部對齊
    W = max(f.width for f in frames); H0 = max(f.height for f in frames)
    if any(f.size != (W, H0) for f in frames):
        canv = []
        for f in frames:
            c = Image.new('RGBA', (W, H0)); fb = f.getchannel('A').getbbox() or (0, 0, f.width, f.height)
            c.paste(f, ((W - f.width) // 2, H0 - fb[3]), f); canv.append(c)
        frames = canv
    boxes = [f.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox() for f in frames]
    box = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
    frames = [f.crop(box) for f in frames]
    w, h = frames[0].size
    # 錨點:各格腳底中心的平均
    axs = []
    for f in frames:
        a = f.getchannel('A').load()
        xs = [x for y in range(int(h * 0.94), h) for x in range(w) if a[x, y] > 128]
        if xs: axs.append(sum(xs) / len(xs))
    ax = sum(axs) / len(axs) if axs else w / 2
    kind = code.split('_', 1)[1] if '_' in code else code
    Hl = OVERRIDE.get(code, HEIGHT.get(kind, 22))
    scale = Hl * PIXELS_PER_UNIT / h
    srcs, total = [], 0
    for f in frames:
        src, n = encode(f, scale); srcs.append(src); total += n
    return {'frames': srcs, 'fps': FPS[state], 'w': round(w * Hl / h, 2), 'h': Hl, 'ax': round(ax * Hl / h, 2), 'ay': Hl}, total


def main():
    data, anims = {}, {}
    pat = re.compile(r'^(.+?)_(' + '|'.join(STATES) + r')(?:_(\d+))?$')
    for f in sorted(os.listdir(SRC)):
        name, ext = os.path.splitext(f)
        if ext.lower() not in ('.png', '.webp', '.jpg', '.jpeg'):
            continue
        m = pat.match(name)
        if m:
            code, state, idx = m.group(1), m.group(2), m.group(3)
            im = Image.open(os.path.join(SRC, f))
            lst = anims.setdefault(code, {}).setdefault(state, [])
            if idx is None:
                lst.extend((0, i, fr) for i, fr in enumerate(split_sheet(remove_bg(im))))
            else:
                lst.append((int(idx), 0, im))
            continue
        data[name], size = process(os.path.join(SRC, f), name)
        print(f'{name}: {data[name]["w"]}x{data[name]["h"]} 邏輯像素, {size // 1024} KB')
    for code, states in anims.items():
        entry = data.setdefault(code, {})
        entry.setdefault('anims', {})
        for state, lst in states.items():
            lst.sort(key=lambda t: (t[0], t[1]))
            a, size = process_anim(code, state, [t[2] for t in lst])
            entry['anims'][state] = a
            print(f'{code} {state}: {len(lst)} 格, {size // 1024} KB')
        if 'src' not in entry:   # 沒有靜態圖時:優先用待命第一格,否則用步行第二格(雙腳併攏)
            a = entry['anims']
            if code in STAND_FRAME and STAND_FRAME[code][0] in a:
                st, n = STAND_FRAME[code]
                sa = a[st]
                entry.update({'src': sa['frames'][min(n, len(sa['frames'])) - 1], 'w': sa['w'], 'h': sa['h'], 'ax': sa['ax'], 'ay': sa['ay']})
                continue
            first = a.get('idle') or a.get('walk') or next(iter(a.values()))
            fr = first['frames'][1] if first is a.get('walk') and not a.get('idle') and len(first['frames']) > 1 else first['frames'][0]
            entry.update({'src': fr, 'w': first['w'], 'h': first['h'], 'ax': first['ax'], 'ay': first['ay']})
    with open(OUT, 'w', encoding='utf-8') as fp:
        fp.write("'use strict';\n// 由 tools/pack_sprites.py 產生,請勿手動修改\n")
        fp.write('const SPRITE_DATA = ' + json.dumps(data, ensure_ascii=False, indent=1) + ';\n')


if __name__ == '__main__':
    main()
