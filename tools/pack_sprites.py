"""把 art/src/ 裡的美術圖處理成遊戲用的精靈資料:python3 tools/pack_sprites.py

- 自動去背(透明背景直接使用;純綠 #00FF00 或純白背景會被去除)
- 裁切到主體範圍,找出腳底(底部像素的中心)當作錨點
- 依類型縮放,輸出 js/sprites_data.js(base64 內嵌,單一 HTML 也能用)
"""
import base64, io, json, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'art', 'src')
OUT = os.path.join(ROOT, 'js', 'sprites_data.js')

# 遊戲中的顯示高度(邏輯像素,從圖的最高點到腳底)。可在檔名對應的條目調整。
HEIGHT = {'inf': 21, 'inf2': 22, 'light': 30, 'tank': 26, 'art': 28, 'harvester': 24, 'engineer': 19}
OVERRIDE = {}          # 例:{'jp_inf2': 24}
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


def main():
    data = {}
    for f in sorted(os.listdir(SRC)):
        code, ext = os.path.splitext(f)
        if ext.lower() not in ('.png', '.webp', '.jpg', '.jpeg'):
            continue
        data[code], size = process(os.path.join(SRC, f), code)
        print(f'{code}: {data[code]["w"]}x{data[code]["h"]} 邏輯像素, {size // 1024} KB')
    with open(OUT, 'w', encoding='utf-8') as fp:
        fp.write("'use strict';\n// 由 tools/pack_sprites.py 產生,請勿手動修改\n")
        fp.write('const SPRITE_DATA = ' + json.dumps(data, ensure_ascii=False, indent=1) + ';\n')


if __name__ == '__main__':
    main()
