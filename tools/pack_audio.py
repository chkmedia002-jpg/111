"""將 art/audio/*.mp3 打包成 js/voice_data.js(base64):python3 tools/pack_audio.py
檔名即語音代號,例如 unit_ready.mp3 → VOICE_DATA.unit_ready"""
import base64, glob, json, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data = {}
for f in sorted(glob.glob(os.path.join(root, 'art/audio/*.mp3'))):
    data[os.path.splitext(os.path.basename(f))[0]] = base64.b64encode(open(f, 'rb').read()).decode()
    print(os.path.basename(f), os.path.getsize(f) // 1024, 'KB')
with open(os.path.join(root, 'js/voice_data.js'), 'w') as out:
    out.write("'use strict';\n// 由 tools/pack_audio.py 產生,請勿手動編輯\nconst VOICE_DATA = " + json.dumps(data) + ";\n")
