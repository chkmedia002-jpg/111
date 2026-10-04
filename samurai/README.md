# 三日月の武者 — 武士 3D 模型（已綁定骨架與動畫）

依參考圖（黑漆大鎧、金色三日月前立、背負白色旗指物、雙手持太刀斜舉的弓步姿勢）以程式化方式建模（three.js）。

| 檔案 | 說明 |
| --- | --- |
| `samurai.glb` | glTF 2.0 二進位檔：蒙皮網格＋骨架＋4 段動畫，可直接匯入 Blender、Unity、Unreal、Godot |
| `index.html` | 互動式檢視器（已內嵌 GLB）：切換動作、顯示骨架、拖曳旋轉 |
| `src/samurai.js` | 建模、骨架、蒙皮權重與動畫的原始碼 |
| `build.mjs` | 產生 `samurai.glb` 與 `index.html` |

## 模型結構

- 單位：公尺，+Y 朝上，人物面向 +Z；綁定姿勢（rest pose）為中段構（雙手持刀於身前）。
- 約 4.4 萬三角面，單一 SkinnedMesh，15 種 PBR 材質（黑漆、白色縅糸、金、鋼、袴等）。
- 包含：兜（筋兜鉢、眉庇、四段錣、吹返、三日月前立）、胴、草摺六間、大袖、籠手、臑当、袴、足袋與草鞋、腰帶、太刀、鞘、脇差、背旗。

## 骨架（19 根）

```
Hips
├─ Spine
│  ├─ Neck ─ Head
│  ├─ Shoulder_R ─ UpperArm_R ─ LowerArm_R ─ Hand_R ─ Katana
│  └─ Shoulder_L ─ UpperArm_L ─ LowerArm_L ─ Hand_L
├─ UpperLeg_R ─ LowerLeg_R ─ Foot_R
└─ UpperLeg_L ─ LowerLeg_L ─ Foot_L
```

- 肢體骨骼的 +Y 沿骨頭方向、+Z 指向關節彎曲方向（膝向前、肘向下外）。
- 鎧甲多為剛體，大部分頂點 100% 綁在單一骨頭上；跨關節的部位做雙骨混合：袴的臀部（Hips/UpperLeg）、草摺下段跟隨大腿、大袖一半跟肩一半跟上臂。
- 太刀是 `Hand_R` 的子骨頭，可在引擎中單獨掛載或替換武器。

## 動畫

| 名稱 | 長度 | 說明 |
| --- | --- | --- |
| `Idle` | 2.4 s 循環 | 中段構待機，帶呼吸起伏 |
| `Walk` | 1.0 s 循環 | 原地步行（in-place），持刀於中段；對應前進速度約 0.67 m/s |
| `Attack` | 1.5 s | 舉刀過右肩 → 踏步 → 袈裟斬 → 殘心 → 回到中段構（首尾與 Idle 相接） |
| `Pose_Reference` | 2.4 s 循環 | 參考圖的弓步斜舉姿勢 |

動畫以控制點（腰、腳、刀的位置與方向）描述，每幀用兩段 IK 解出手臂與腿的骨頭旋轉後烘焙成關鍵影格（30 fps），所以雙手始終握在刀柄上、腳踩在地面上。要調整動作，修改 `src/samurai.js` 中的 `idle` / `walk` / `attackKeys` / `reference` 再重新建置。

## 重新建置

```bash
npm install three@0.170.0  # 匯出用；檢視器從 CDN 載入 three@0.147.0（傳統 script 版本，相容性較好）
node build.mjs
```
