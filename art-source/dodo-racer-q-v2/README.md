# 豆豆 Dodo — Q 版 v2

依 2026-10-15 使用者回饋改為 Q 版：接近兩頭身的輪廓、大圓頭、短軀幹與短四肢、圓手套和寬鞋；簡化成黑亮眼、小鼻子、短微笑及腮紅，保留原創護目鏡、三撮髮型、青橘服裝和雙折線隊徽。材質改為較柔和的霧面。

- `dodo-racer-q-v2.blend`：可編輯分件模型、攝影棚與燈光。
- `dodo-racer-q-v2.glb`：僅角色，Y-up、前方 -Z、公尺單位。
- `dodo-hero.png`、`dodo-front.png`、`dodo-back.png`：實際 Cycles 渲染。
- 生成腳本：`scripts/build-dodo-chibi.py`，以 Blender 4.5 LTS 執行。
- 第一版保留於 `art-source/dodo-racer/`，方便比較。

這是獨立造型研究稿；未綁骨架、未製作坐姿／動畫、未加入遊戲，也尚未依正式遊戲幾何預算減面。未改 Next.js 或遊戲程式。驗證以 Blender 成功生成、GLB 結構檢查及三角度渲染檢視為準。上一輪完整遊戲檢查曾出現測試逾時；本輪只改美術研究稿，未重跑同一組遊戲檢查。
