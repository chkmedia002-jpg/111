# 三日月の武者 — 武士 3D 模型

依參考圖（黑漆大鎧、金色三日月前立、背負白色旗指物、雙手持太刀斜舉的弓步姿勢）以程式化方式建模（three.js）。

| 檔案 | 說明 |
| --- | --- |
| `samurai.glb` | 匯出的 glTF 2.0 二進位模型，可直接匯入 Blender、Unity、Unreal、Godot 或任何 glTF 檢視器 |
| `index.html` | 互動式檢視器（拖曳旋轉、滾輪縮放），用瀏覽器開啟即可 |
| `src/samurai.js` | 建模原始碼：`buildSamurai(THREE)` 回傳模型 Group |
| `build.mjs` | 產生 `samurai.glb` 與 `index.html` |

## 模型結構

- 單位：公尺，+Y 朝上，人物面向 +Z；全高約 1.8 m（含前立），旗竿頂約 2.1 m。
- 約 4.4 萬三角面，按部位分組（Torso、LegLeft/Right、ArmLeft/Right、Katana 等），每組依材質合併。
- 材質（PBR metallic-roughness）：黑漆、白色縅糸、白布、袴、金、皮膚、鋼、柄卷、草鞋、旗布等。
- 包含：兜（筋兜鉢、眉庇、四段錣、吹返、三日月前立）、胴（七段札板＋縅糸）、草摺六間、大袖、籠手、臑当（篠＋膝甲＋綁繩）、袴、足袋與草鞋、白腰帶結、太刀（反り、鍔、柄卷）、鞘與脇差柄、背旗。

姿勢由 `src/samurai.js` 開頭的關節座標控制（腿與手臂用兩段 IK 求解），修改後重新建置即可。

## 重新建置

```bash
npm install three@0.170.0
node build.mjs
```
