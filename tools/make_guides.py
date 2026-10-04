"""產生等角透視參考圖(給生圖 AI 當構圖範本):python3 tools/make_guides.py"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'docs', 'guides')
FONT = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
S = 1254                      # 與生圖 AI 輸出尺寸相同


def guide(n, wall_h=0.32, roof=False, labels=True, bg=(255, 255, 255, 255)):
    im = Image.new('RGBA', (S, S), bg)
    d = ImageDraw.Draw(im)
    margin = 40
    tw = (S - margin * 2) / n          # 一格的菱形寬度
    th = tw / 2                        # 2:1 等角:高度是寬度的一半
    cx = S / 2
    front_y = S - 70                   # 菱形前角(最下方)的位置
    top_y = front_y - n * th * 2 / 2 * 2 / 2 * 2  # = front_y - n*th
    top_y = front_y - n * th

    def P(x, y, z=0):                  # 格子座標 -> 圖片座標(x 往右下、y 往左下、z 往上,單位:格寬)
        return (cx + (x - y) * tw / 2, top_y + (x + y) * th / 2 - z * tw)
    # 地面格子
    for i in range(n + 1):
        d.line([P(i, 0), P(i, n)], fill=(120, 170, 120, 255), width=3)
        d.line([P(0, i), P(n, i)], fill=(120, 170, 120, 255), width=3)
    poly = [P(0, 0), P(n, 0), P(n, n), P(0, n)]
    d.polygon(poly, outline=(30, 120, 40, 255))
    for a, b in zip(poly, poly[1:] + poly[:1]):
        d.line([a, b], fill=(30, 120, 40, 255), width=7)
    # 牆面高度參考框(垂直線永遠垂直)
    h = wall_h                         # 牆高(以格寬為單位),遊戲內建築牆面約 1/3 格寬
    red = (210, 50, 40, 255)
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0)); od = ImageDraw.Draw(ov)
    od.polygon([P(0, n), P(n, n), P(n, n, h), P(0, n, h)], fill=(230, 120, 100, 70))     # 左前牆
    od.polygon([P(n, 0), P(n, n), P(n, n, h), P(n, 0, h)], fill=(190, 80, 70, 90))      # 右前牆
    od.polygon([P(0, 0, h), P(n, 0, h), P(n, n, h), P(0, n, h)], fill=(240, 200, 120, 60))  # 頂面
    im.alpha_composite(ov); d = ImageDraw.Draw(im)
    for (x, y) in [(0, n), (n, n), (n, 0)]:
        d.line([P(x, y), P(x, y, h)], fill=red, width=4)
    d.line([P(0, n, h), P(n, n, h), P(n, 0, h)], fill=red, width=4)
    d.line([P(0, n, h), P(0, 0, h), P(n, 0, h)], fill=(210, 50, 40, 110), width=3)
    d.line([P(0, 0), P(0, 0, h)], fill=(210, 50, 40, 110), width=3)
    if roof:
        ridge_h = h + 0.3
        r1, r2 = P(n * 0.5, n * 0.5 - n * 0.35, ridge_h), P(n * 0.5, n * 0.5 + n * 0.35, ridge_h)
        blue = (40, 80, 200, 255)
        for c in [(0, n), (n, n), (n, 0), (0, 0)]:
            d.line([P(c[0], c[1], h), r1 if c[1] == 0 else r2], fill=blue, width=3)
        d.line([r1, r2], fill=blue, width=5)
    if labels:
        f = ImageFont.truetype(FONT, 38)
        fs = ImageFont.truetype(FONT, 30)
        d.text((40, 30), f'{n}×{n} 地基(等角 2:1)', font=f, fill=(20, 20, 20, 255))
        d.text((40, 82), '綠色菱形 = 地基範圍,建築要剛好蓋滿', font=fs, fill=(30, 120, 40, 255))
        d.text((40, 120), '紅線 = 牆面,垂直線一定垂直', font=fs, fill=red)
        d.text((40, 158), '斜邊:往旁邊 2、往上 1(約 26.6°),四條邊兩兩平行,沒有消失點', font=fs, fill=(90, 90, 90, 255))
        d.text((40, 196), '地基菱形的左右兩角要接近畫面左右邊緣', font=fs, fill=(90, 90, 90, 255))
    return im


os.makedirs(OUT, exist_ok=True)
for n in (1, 2, 3):
    guide(n).save(os.path.join(OUT, f'footprint_{n}x{n}.png'))
    guide(n, roof=False, labels=False, bg=(0, 0, 0, 0)).save(os.path.join(OUT, f'footprint_{n}x{n}_clean.png'))
print('done')
