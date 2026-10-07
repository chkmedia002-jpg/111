# 武士戰線 — 3D 即時戰略 MVP

類似《紅色警戒》的極簡即時戰略，採用部落衝突（Clash of Clans）式 2.5D 等角視角，但角色與建築都是 3D 模型：選擇「武士 Samurai Warrior」角色，訓練部隊、指揮武士攻擊敵軍，摧毀紅色指揮中心即獲勝。

- 引擎：[Three.js](https://threejs.org/)（透過 CDN 載入，無需建置）
- 角色模型：`assets/samurai.glb`（由 Meshy AI Stylized Samurai 的 Running / Walking 動畫合併並壓縮，約 2MB）
- 武士刀模型：`assets/sword.glb`（Meshy AI 武士刀，掛在右手骨骼上，約 230KB）
- 指揮中心模型：`assets/house.glb`（Meshy AI 木石工坊，減面並壓縮到約 1.7MB）

## 執行

因為使用 ES module 與 glTF 載入，需要透過本機 HTTP 伺服器開啟：

```bash
python3 -m http.server 8000
# 瀏覽器開啟 http://localhost:8000
```

也可以直接開啟 GitHub Pages（在 repo 設定中啟用 Pages，來源選這個分支的根目錄）。

## 玩法

| 操作 | 滑鼠／鍵盤 | 觸控 |
| --- | --- | --- |
| 選取單位 | 左鍵點選、拖曳框選、Shift 加選、Ctrl+A 全選 | 點單位、「全選」按鈕 |
| 移動 | 右鍵點地面 | 選取後點地面 |
| 攻擊 | 右鍵點敵人 | 選取後點敵人 |
| 攻擊移動 | A＋右鍵，或按「攻擊移動」後點地面 | 「攻擊移動」按鈕後點地面 |
| 訓練武士（$100） | Q 或「訓練武士」按鈕 | 按鈕 |
| 停止 | X | 「停止」按鈕 |
| 鏡頭 | 方向鍵、邊緣捲動、中鍵拖曳、滾輪縮放、空白鍵回基地、點小地圖 | 單指拖曳、雙指縮放、點小地圖 |
| 集結點 | 選取指揮中心後右鍵 | — |

- 資金會隨時間自動增加，擊殺敵人 +$25。
- 敵方 AI 會持續訓練武士並分波進攻，攻擊其基地時會全軍回防。
- 開始畫面可選對手難度（影響敵方收入）。

## 檔案

- `index.html` — 介面（角色選擇、HUD、結束畫面）
- `style.css` — 樣式
- `game.js` — 遊戲邏輯（單位、AI、戰鬥、輸入、鏡頭、小地圖）
- `assets/samurai.glb` — 武士模型與動畫
- `assets/house.glb` — 指揮中心（工坊）模型
- `assets/sword.glb` — 武士刀模型
