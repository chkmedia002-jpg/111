"""將遊戲合併成單一 HTML 檔:python3 build.py"""
import re, sys
html = open('index.html', encoding='utf-8').read()
css = open('style.css', encoding='utf-8').read()
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + css + '</style>')
def inline(m):
    return '<script>\n' + open(m.group(1), encoding='utf-8').read() + '</script>'
html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
open('steel-dawn-2050.html', 'w', encoding='utf-8').write(html)
if len(sys.argv) > 1:
    # 發佈用:移除外層 doctype/html/head/body 標籤
    body = re.sub(r'<!doctype html>\s*<html[^>]*>\s*<head>\s*', '', html)
    body = body.replace('</head>\n<body>', '').replace('</body>\n</html>', '')
    body = re.sub(r'<meta[^>]*>\s*', '', body)
    open(sys.argv[1], 'w', encoding='utf-8').write(body)
print('ok', len(html))
