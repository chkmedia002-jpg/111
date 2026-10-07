"""把 render.js 的輸出裁成共同範圍並轉成 WebP,縮小檔案:python3 compact.py <輸出資料夾>"""
import json, os, sys
from PIL import Image

d = sys.argv[1]
meta = json.load(open(os.path.join(d, 'meta.json')))
files = sorted(f for f in os.listdir(d) if f.endswith('.png'))
box = None
for f in files:
    b = Image.open(os.path.join(d, f)).getchannel('A').getbbox()
    if b:
        box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
box = (max(0, box[0] - 2), max(0, box[1] - 2), box[2] + 2, box[3] + 2)
for f in files:
    p = os.path.join(d, f)
    Image.open(p).crop(box).save(p[:-4] + '.webp', 'WEBP', quality=92, method=6)
    os.remove(p)
meta['anchor'] = [meta['anchor'][0] - box[0], meta['anchor'][1] - box[1]]
meta['crop'] = [box[2] - box[0], box[3] - box[1]]
json.dump(meta, open(os.path.join(d, 'meta.json'), 'w'), indent=1)
print(f'裁切為 {meta["crop"][0]}x{meta["crop"][1]},共 {len(files)} 格')
