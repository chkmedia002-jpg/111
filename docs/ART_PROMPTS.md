# 美術素材生圖 Prompt(1592 壬辰之役)

每段 prompt 都是完整的,直接整段複製貼到生圖 AI 即可。共 41 張:17 個單位 + 24 棟建築。

## 一、交給我的成品格式

| 項目 | 規格 |
|---|---|
| 檔案格式 | PNG |
| 背景 | **純綠色 #00FF00**(prompt 已寫好,我會用程式自動去背)。如果你的工具能直接輸出透明背景也可以 |
| 尺寸 | 正方形。單位 **1024×1024**、建築 **1024×1024**(工具若只能 512 也可以) |
| 方向 | 單位一律**面向右下方**,其他方向我會用翻轉和旋轉補上 |
| 檔名 | 每段 prompt 上方的 `檔名`,例如 `mg_inf.png`,不要改 |
| 交付方式 | 把全部 PNG 放進一個資料夾,壓成 `art.zip` 上傳到對話;也可以一次上傳幾張圖 |

**檢查清單**(不合格就重新生成一次):
- 只有**一個**角色或一棟建築,沒有多餘的人、樹、地面、文字
- 背景是一整片純綠色,而且**主體本身沒有用到亮綠色**
- 單位腳底貼近畫面下緣,面向右下
- 建築的地基呈菱形,整棟都在畫面內,沒有被裁掉

**各工具用法:**
- **ChatGPT**:直接貼上即可。若它畫了地面或陰影,補一句「重畫,只要純綠背景」
- **Midjourney**:在每段最後加上 ` --ar 1:1 --style raw --v 7`。第一張滿意後,後面每張都加 `--sref 第一張圖片網址`,畫風會統一
- **Stable Diffusion**:負面提示詞填 `ground, grass, shadow, text, watermark, multiple characters, cropped, blurry`

**建議順序:** 先做 `mg_inf`、`jp_inf2`、`kr_inf` 三張給我測試,確認效果再做其餘的。

## 二、單位(17 張)

### 大明 Ming

**鳥銃手** · 檔名 `mg_inf.png`

```
isometric RTS game unit sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single character, full body, facing bottom-right, centered horizontally, standing on the bottom of the frame with 10% margin below, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no shadow, no text, no border, no other objects, Ming dynasty Chinese musketeer, 1592, red padded cotton armor coat with brass studs, round iron helmet with a red horsehair tassel, white leg wraps, holding a long matchlock musket at the ready, glowing slow match
```

**狼筅長槍兵** · 檔名 `mg_inf2.png`

```
isometric RTS game unit sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single character, full body, facing bottom-right, centered horizontally, standing on the bottom of the frame with 10% margin below, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no shadow, no text, no border, no other objects, Ming dynasty Chinese spearman of Qi Jiguang's army, 1592, red padded armor coat with brass studs, round iron helmet with red tassel, holding a very long bamboo langxian spear with leafy branches near the iron tip, held forward
```

**遼東鐵騎** · 檔名 `mg_light.png`

```
isometric RTS game unit sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single character, full body, facing bottom-right, centered horizontally, standing on the bottom of the frame with 10% margin below, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no shadow, no text, no border, no other objects, Ming dynasty heavy cavalryman, 1592, rider in red brigandine armor and iron helmet with red tassel on an armored brown war horse, holding a long lance with a small red pennant, horse in mid-gallop
```

**偏廂戰車** · 檔名 `mg_tank.png`

```
isometric RTS game unit sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single war machine, full body, facing bottom-right, centered horizontally, standing on the bottom of the frame with 10% margin below, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no shadow, no text, no border, no other objects, Ming dynasty war cart, 1592, heavy wooden cart with a tall wooden shield wall on one side painted with a fierce tiger face, two small bronze breech-loading Frankish cannons poking forward, two large spoked wooden wheels, red cloth trim
```

**大將軍砲** · 檔名 `mg_art.png`

```
isometric RTS game unit sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single war machine, full body, facing bottom-right, centered horizontally, standing on the bottom of the frame with 10% margin below, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no shadow, no text, no border, no other objects, Ming dynasty heavy bronze cannon on a wooden field carriage, 1592, long bronze barrel with decorative rings, two large spoked wooden wheels, one Chinese gunner in red uniform standing beside it holding a ramrod
```

### 日本 Japan

**鐵砲足輕** · 檔名 `jp_inf.png`

```
isometric RTS game unit sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single character, full body, facing bottom-right, centered horizontally, standing on the bottom of the frame with 10% margin below, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no shadow, no text, no border, no other objects, Japanese ashigaru matchlock gunner, Sengoku period 1592, conical black jingasa hat, dark indigo clothing with simple black lacquered chest armor, small white sashimono banner with a red circle on his back, holding a tanegashima matchlock gun
```

**武士** · 檔名 `jp_inf2.png`

```
isometric RTS game unit sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single character, full body, facing bottom-right, centered horizontally, standing on the bottom of the frame with 10% margin below, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no shadow, no text, no border, no other objects, Japanese samurai warrior, Sengoku period 1592, black lacquered armor with white silk lacing, kabuto helmet with a golden crescent crest, white sashimono banner on his back, katana raised in a fighting stance
```

**騎馬武者** · 檔名 `jp_light.png`

```
isometric RTS game unit sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single character, full body, facing bottom-right, centered horizontally, standing on the bottom of the frame with 10% margin below, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no shadow, no text, no border, no other objects, Japanese mounted samurai, Sengoku period 1592, rider in black and white lacquered armor with kabuto helmet, white sashimono banner on his back, holding a long yari spear, riding a dark brown horse in mid-gallop
```

**大筒車** · 檔名 `jp_tank.png`

```
isometric RTS game unit sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single war machine, full body, facing bottom-right, centered horizontally, standing on the bottom of the frame with 10% margin below, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no shadow, no text, no border, no other objects, Japanese oozutsu cannon cart, Sengoku period 1592, short thick black iron cannon on a simple wooden carriage with two spoked wheels, one ashigaru gunner with a jingasa hat standing beside it
```

**焙烙投石車** · 檔名 `jp_art.png`

```
isometric RTS game unit sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single war machine, full body, facing bottom-right, centered horizontally, standing on the bottom of the frame with 10% margin below, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no shadow, no text, no border, no other objects, Japanese wooden siege catapult on a wheeled cart, Sengoku period 1592, traction trebuchet frame with a throwing arm, a burning clay fire pot loaded in the sling, white cloth banner with a red circle, one ashigaru crew member
```

### 朝鮮 Joseon

**弓手** · 檔名 `kr_inf.png`

```
isometric RTS game unit sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single character, full body, facing bottom-right, centered horizontally, standing on the bottom of the frame with 10% margin below, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no shadow, no text, no border, no other objects, Joseon Korean archer, 1592, white cotton robe with a blue sleeveless military vest, black wide-brim beonggeoji hat with a red tassel, drawing a short recurved composite bow with an arrow, quiver of arrows on his back
```

**殺手** · 檔名 `kr_inf2.png`

```
isometric RTS game unit sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single character, full body, facing bottom-right, centered horizontally, standing on the bottom of the frame with 10% margin below, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no shadow, no text, no border, no other objects, Joseon Korean sword-and-shield infantryman, 1592, white robe with blue armored vest, black wide-brim hat with red tassel, round wooden shield painted with a blue taegeuk pattern, short straight sword raised
```

**騎射手** · 檔名 `kr_light.png`

```
isometric RTS game unit sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single character, full body, facing bottom-right, centered horizontally, standing on the bottom of the frame with 10% margin below, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no shadow, no text, no border, no other objects, Joseon Korean horse archer, 1592, rider in white robe and blue vest with black wide-brim hat with red tassel, drawing a composite bow while riding a light brown horse in mid-gallop
```

**華車** · 檔名 `kr_tank.png`

```
isometric RTS game unit sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single war machine, full body, facing bottom-right, centered horizontally, standing on the bottom of the frame with 10% margin below, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no shadow, no text, no border, no other objects, Joseon Korean hwacha rocket launcher cart, 1592, two-wheeled wooden cart carrying a tilted wooden rack with a grid of 100 singijeon fire arrows, arrow tips pointing forward and upward, blue cloth trim, one Korean soldier beside it
```

**震天雷砲** · 檔名 `kr_art.png`

```
isometric RTS game unit sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single war machine, full body, facing bottom-right, centered horizontally, standing on the bottom of the frame with 10% margin below, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no shadow, no text, no border, no other objects, Joseon Korean bronze mortar on a low wooden carriage, 1592, short wide-mouthed bronze barrel pointing upward, a round black iron bigyeokjincheonroe exploding shell beside it, one Korean gunner with black wide-brim hat
```

### 共用 Shared

**運銀牛車** · 檔名 `harvester.png`

```
isometric RTS game unit sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single war machine, full body, facing bottom-right, centered horizontally, standing on the bottom of the frame with 10% margin below, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no shadow, no text, no border, no other objects, East Asian ox cart carrying silver ore, 1592, one strong brown ox with curved horns pulling a two-wheeled wooden cart loaded with a heap of shiny grey silver ore, a peasant driver in a straw hat sitting at the front
```

**工匠** · 檔名 `engineer.png`

```
isometric RTS game unit sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single character, full body, facing bottom-right, centered horizontally, standing on the bottom of the frame with 10% margin below, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no shadow, no text, no border, no other objects, East Asian military craftsman, 1592, simple brown work clothes with a cloth headband, carrying a wooden mallet in one hand and a toolbox on his back
```

## 三、建築(24 張)

### 大明 Ming

**總兵府(主基地)** · 檔名 `mg_conyard.png`

```
isometric RTS game building sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single building on a square stone foundation seen as a diamond, the whole building fits inside the frame with 5% margin, front corner of the foundation at the bottom center, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no trees, no shadow, no text, no border, no people, Ming dynasty Chinese architecture, red walls and red lacquered pillars, grey glazed tile roofs with upturned eave corners, golden painted brackets, red banners, Ming dynasty city gate tower: a high grey brick platform with an arched gateway, crenellated battlements, and a two-story red wooden tower on top with double-eave grey tiled roofs, red banners on the corners
```

**農田**(原糧倉) · 檔名 `mg_power.png`

```
isometric RTS game building sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single building on a square stone foundation seen as a diamond, the whole building fits inside the frame with 5% margin, front corner of the foundation at the bottom center, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no trees, no shadow, no text, no border, no people, Ming dynasty Chinese architecture, red walls and red lacquered pillars, grey glazed tile roofs with upturned eave corners, golden painted brackets, red banners, Ming dynasty granary: a raised wooden storehouse on short stone stilts with a large hip roof, sacks of rice stacked in front
```

**銀礦冶坊** · 檔名 `mg_refinery.png`

```
isometric RTS game building sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single building on a square stone foundation seen as a diamond, the whole building fits inside the frame with 5% margin, front corner of the foundation at the bottom center, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no trees, no shadow, no text, no border, no people, Ming dynasty Chinese architecture, red walls and red lacquered pillars, grey glazed tile roofs with upturned eave corners, golden painted brackets, red banners, Ming dynasty silver smelting workshop: a red-pillared hall with a grey tile roof, a large round brick furnace with glowing orange fire and smoke, piles of grey silver ore beside it, small rail track
```

**校場** · 檔名 `mg_barracks.png`

```
isometric RTS game building sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single building on a square stone foundation seen as a diamond, the whole building fits inside the frame with 5% margin, front corner of the foundation at the bottom center, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no trees, no shadow, no text, no border, no people, Ming dynasty Chinese architecture, red walls and red lacquered pillars, grey glazed tile roofs with upturned eave corners, golden painted brackets, red banners, Ming dynasty military training hall: a long red-pillared hall with a grey tile roof, a wooden weapon rack full of spears in front, a straw training dummy, red army banner
```

**軍器局** · 檔名 `mg_factory.png`

```
isometric RTS game building sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single building on a square stone foundation seen as a diamond, the whole building fits inside the frame with 5% margin, front corner of the foundation at the bottom center, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no trees, no shadow, no text, no border, no people, Ming dynasty Chinese architecture, red walls and red lacquered pillars, grey glazed tile roofs with upturned eave corners, golden painted brackets, red banners, Ming dynasty arsenal workshop: an open-sided timber hall with a grey tile roof on red pillars, a blacksmith forge glowing inside, an anvil, stacked logs and a spare wooden cart wheel
```

**兵部書院** · 檔名 `mg_tech.png`

```
isometric RTS game building sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single building on a square stone foundation seen as a diamond, the whole building fits inside the frame with 5% margin, front corner of the foundation at the bottom center, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no trees, no shadow, no text, no border, no people, Ming dynasty Chinese architecture, red walls and red lacquered pillars, grey glazed tile roofs with upturned eave corners, golden painted brackets, red banners, Ming dynasty academy pavilion: an elegant two-story pavilion with double grey tiled roofs, red lattice windows, red paper lanterns, a golden finial on the roof
```

**敵台(防禦塔)** · 檔名 `mg_turret.png`

```
isometric RTS game building sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single building on a square stone foundation seen as a diamond, the whole building fits inside the frame with 5% margin, front corner of the foundation at the bottom center, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no trees, no shadow, no text, no border, no people, Ming dynasty Chinese architecture, red walls and red lacquered pillars, grey glazed tile roofs with upturned eave corners, golden painted brackets, red banners, Ming dynasty square brick watchtower with crenellated top, a small bronze cannon on top, arrow slits, a red banner
```

**火龍出水(奇兵)** · 檔名 `mg_super.png`

```
isometric RTS game building sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single building on a square stone foundation seen as a diamond, the whole building fits inside the frame with 5% margin, front corner of the foundation at the bottom center, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no trees, no shadow, no text, no border, no people, Ming dynasty Chinese architecture, red walls and red lacquered pillars, grey glazed tile roofs with upturned eave corners, golden painted brackets, red banners, Ming dynasty rocket launch platform: a wooden ramp on a stone platform holding a large dragon-shaped rocket painted red and gold with a dragon head, four burning braziers at the corners
```

### 日本 Japan

**本丸天守(主基地)** · 檔名 `jp_conyard.png`

```
isometric RTS game building sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single building on a square stone foundation seen as a diamond, the whole building fits inside the frame with 5% margin, front corner of the foundation at the bottom center, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no trees, no shadow, no text, no border, no people, Sengoku period Japanese architecture, white plaster walls with black wooden panels on the lower half, dark grey tile roofs with gently curved eaves, white banners with a red circle, Japanese castle keep (tenshu): a sloped stone base with three stacked tiers of white plaster walls and black panels, each tier with a dark grey curved tile roof, golden shachihoko fish ornaments on the top ridge
```

**農田**(原米藏) · 檔名 `jp_power.png`

```
isometric RTS game building sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single building on a square stone foundation seen as a diamond, the whole building fits inside the frame with 5% margin, front corner of the foundation at the bottom center, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no trees, no shadow, no text, no border, no people, Sengoku period Japanese architecture, white plaster walls with black wooden panels on the lower half, dark grey tile roofs with gently curved eaves, white banners with a red circle, Japanese rice storehouse (kura): a white plaster storehouse with black lower panels and a heavy dark tile roof, straw rice bales stacked in front
```

**銀山吹屋** · 檔名 `jp_refinery.png`

```
isometric RTS game building sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single building on a square stone foundation seen as a diamond, the whole building fits inside the frame with 5% margin, front corner of the foundation at the bottom center, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no trees, no shadow, no text, no border, no people, Sengoku period Japanese architecture, white plaster walls with black wooden panels on the lower half, dark grey tile roofs with gently curved eaves, white banners with a red circle, Japanese silver mine refinery: a wooden hall with a dark tile roof, a round brick smelting furnace with glowing fire and smoke, piles of grey silver ore
```

**足輕長屋** · 檔名 `jp_barracks.png`

```
isometric RTS game building sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single building on a square stone foundation seen as a diamond, the whole building fits inside the frame with 5% margin, front corner of the foundation at the bottom center, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no trees, no shadow, no text, no border, no people, Sengoku period Japanese architecture, white plaster walls with black wooden panels on the lower half, dark grey tile roofs with gently curved eaves, white banners with a red circle, Japanese ashigaru barracks: a long wooden row house with white walls and black panels, dark tile roof, a rack of yari spears in front, white sashimono banners
```

**鍛冶場** · 檔名 `jp_factory.png`

```
isometric RTS game building sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single building on a square stone foundation seen as a diamond, the whole building fits inside the frame with 5% margin, front corner of the foundation at the bottom center, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no trees, no shadow, no text, no border, no people, Sengoku period Japanese architecture, white plaster walls with black wooden panels on the lower half, dark grey tile roofs with gently curved eaves, white banners with a red circle, Japanese blacksmith workshop: an open timber hall with a dark tile roof, a glowing forge, anvil, swords and gun barrels on racks, stacked charcoal
```

**軍學所** · 檔名 `jp_tech.png`

```
isometric RTS game building sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single building on a square stone foundation seen as a diamond, the whole building fits inside the frame with 5% margin, front corner of the foundation at the bottom center, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no trees, no shadow, no text, no border, no people, Sengoku period Japanese architecture, white plaster walls with black wooden panels on the lower half, dark grey tile roofs with gently curved eaves, white banners with a red circle, Japanese military academy: an elegant two-story hall with white walls, black panels, curved dark tile roofs, sliding paper doors
```

**鐵砲櫓(防禦塔)** · 檔名 `jp_turret.png`

```
isometric RTS game building sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single building on a square stone foundation seen as a diamond, the whole building fits inside the frame with 5% margin, front corner of the foundation at the bottom center, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no trees, no shadow, no text, no border, no people, Sengoku period Japanese architecture, white plaster walls with black wooden panels on the lower half, dark grey tile roofs with gently curved eaves, white banners with a red circle, Japanese wooden yagura watchtower on four posts, upper room with white plaster walls and black panels, small gun ports with a matchlock barrel sticking out, small dark tile roof, white banner
```

**火攻之陣(奇兵)** · 檔名 `jp_super.png`

```
isometric RTS game building sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single building on a square stone foundation seen as a diamond, the whole building fits inside the frame with 5% margin, front corner of the foundation at the bottom center, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no trees, no shadow, no text, no border, no people, Sengoku period Japanese architecture, white plaster walls with black wooden panels on the lower half, dark grey tile roofs with gently curved eaves, white banners with a red circle, Japanese shrine-like fire ritual site: a large red torii gate on a stone platform with four burning iron braziers at the corners, orange fire glow
```

### 朝鮮 Joseon

**統制營(主基地)** · 檔名 `kr_conyard.png`

```
isometric RTS game building sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single building on a square stone foundation seen as a diamond, the whole building fits inside the frame with 5% margin, front corner of the foundation at the bottom center, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no trees, no shadow, no text, no border, no people, Joseon Korean architecture, white walls with red pillars, grey tile roofs with strongly upturned eaves, colorful dancheong painting in green, blue and red under the eaves, blue banners, Joseon Korean military headquarters hall: a large single-story hall on a stone terrace with central stone steps, red pillars, a huge grey tile hip-and-gable roof with dancheong painted eaves, blue banners
```

**農田**(原軍倉) · 檔名 `kr_power.png`

```
isometric RTS game building sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single building on a square stone foundation seen as a diamond, the whole building fits inside the frame with 5% margin, front corner of the foundation at the bottom center, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no trees, no shadow, no text, no border, no people, Joseon Korean architecture, white walls with red pillars, grey tile roofs with strongly upturned eaves, colorful dancheong painting in green, blue and red under the eaves, blue banners, Joseon Korean army granary: a raised wooden storehouse with a grey tile roof and dancheong eaves, sacks of rice stacked in front
```

**銀店** · 檔名 `kr_refinery.png`

```
isometric RTS game building sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single building on a square stone foundation seen as a diamond, the whole building fits inside the frame with 5% margin, front corner of the foundation at the bottom center, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no trees, no shadow, no text, no border, no people, Joseon Korean architecture, white walls with red pillars, grey tile roofs with strongly upturned eaves, colorful dancheong painting in green, blue and red under the eaves, blue banners, Joseon Korean silver smelting workshop: a hall with red pillars and grey tile roof, a round brick furnace with glowing fire and smoke, piles of grey silver ore
```

**訓練院** · 檔名 `kr_barracks.png`

```
isometric RTS game building sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single building on a square stone foundation seen as a diamond, the whole building fits inside the frame with 5% margin, front corner of the foundation at the bottom center, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no trees, no shadow, no text, no border, no people, Joseon Korean architecture, white walls with red pillars, grey tile roofs with strongly upturned eaves, colorful dancheong painting in green, blue and red under the eaves, blue banners, Joseon Korean training hall: a long hall with red pillars and grey tile roof with dancheong eaves, an archery target and a rack of bows and spears in front, blue banner
```

**軍器寺** · 檔名 `kr_factory.png`

```
isometric RTS game building sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single building on a square stone foundation seen as a diamond, the whole building fits inside the frame with 5% margin, front corner of the foundation at the bottom center, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no trees, no shadow, no text, no border, no people, Joseon Korean architecture, white walls with red pillars, grey tile roofs with strongly upturned eaves, colorful dancheong painting in green, blue and red under the eaves, blue banners, Joseon Korean arsenal workshop: an open timber hall with red pillars and a grey tile roof, a glowing forge, hwacha arrow racks being built, stacked wood
```

**承文院** · 檔名 `kr_tech.png`

```
isometric RTS game building sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single building on a square stone foundation seen as a diamond, the whole building fits inside the frame with 5% margin, front corner of the foundation at the bottom center, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no trees, no shadow, no text, no border, no people, Joseon Korean architecture, white walls with red pillars, grey tile roofs with strongly upturned eaves, colorful dancheong painting in green, blue and red under the eaves, blue banners, Joseon Korean scholar pavilion: an elegant two-story pavilion with red pillars, grey tile roofs and vivid dancheong painted eaves, paper lattice doors
```

**箭樓(防禦塔)** · 檔名 `kr_turret.png`

```
isometric RTS game building sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single building on a square stone foundation seen as a diamond, the whole building fits inside the frame with 5% margin, front corner of the foundation at the bottom center, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no trees, no shadow, no text, no border, no people, Joseon Korean architecture, white walls with red pillars, grey tile roofs with strongly upturned eaves, colorful dancheong painting in green, blue and red under the eaves, blue banners, Joseon Korean tall wooden arrow tower on four red posts with diagonal bracing, an upper platform with a railing and an archer, small grey tile roof with upturned corners
```

**神機箭陣(奇兵)** · 檔名 `kr_super.png`

```
isometric RTS game building sprite in the style of Age of Empires III: The Asian Dynasties, 3/4 top-down view, camera elevated 30 degrees, single building on a square stone foundation seen as a diamond, the whole building fits inside the frame with 5% margin, front corner of the foundation at the bottom center, hand-painted realistic texture, crisp edges, soft daylight from the top-left, plain solid pure green #00FF00 background, no ground, no grass, no trees, no shadow, no text, no border, no people, Joseon Korean architecture, white walls with red pillars, grey tile roofs with strongly upturned eaves, colorful dancheong painting in green, blue and red under the eaves, blue banners, Joseon Korean rocket battery: a stone platform with three hwacha rocket carts lined up side by side, racks full of fire arrows ready to launch, red lanterns
```

## 四、進階:更多方向(之後再做)

單位測試沒問題之後,如果想要更自然的轉向,可以用同一段 prompt,把 `facing bottom-right` 換成下面的字,檔名加上方向代號:

| 方向 | 替換文字 | 檔名範例 |
|---|---|---|
| S 下 | `facing the viewer, front view` | `mg_inf_S.png` |
| E 右 | `facing right, side view` | `mg_inf_E.png` |
| NE 右上 | `facing top-right, seen from behind at an angle` | `mg_inf_NE.png` |
| N 上 | `facing away from the viewer, back view` | `mg_inf_N.png` |
