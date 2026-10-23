# 台灣四圖環境重製｜2026-10-08

> 後續核准：本文件記錄環境美術那一輪。使用者其後核准台北道路與共享操控的 [駕駛手感試作](driving-feel-implementation.md)，台北拓撲與特技規則以該文件及 `document.md` 的最新紀錄為準。
使用者核准 [四圖提案](taiwan-map-redesign.md) 與台北 AI 概念方向後，本輪重建台北、九份、高雄及阿里山的環境美術。以原創建築模組、連續街廓、地形承托和遠近層次取代單獨盒狀建物；路線仍是虛構組合，不複製台灣真實道路。其餘七圖、Kestrel／Aster 車手、三圈、CP、主路與支路、權威／練習駕駛規則沿用既有版本。

## 實際交付

- 台北：可穿行的磚造拱門城樓、兩款帶深騎樓／山牆／凹窗的街屋、節式玻璃高塔，舊城連接屋頂街廓及夜市。大跳所在路面下方新增屋頂承托體；保留原有低層捷運動態景物。
- 九份：連續木窗茶樓、彎曲瓦簷、燈籠與沿坡地基；礦業段有路面下的台地基座，坡壁連成面，海面改為黃褐與蔚藍分區。原有礦車及濕滑海堤操控沿用。
- 高雄：有真正開放通道、斜撐及屋架的港倉；碼頭地坪高於海面、低於可駕駛路面。吊臂及海浪／六角單元建築為原創 GLB，裙樓承托體隨賽道長彎延伸；旋轉側橋和吊掛貨櫃規則沿用。
- 阿里山：木站屋架跨越主路，原創檜木含粗幹、根系及不規則樹冠，茶列／林冠／雲海與山脊分層。原有森林列車交會與稜線側風操控沿用；風口布旗預告側風，跳台下方另有原創紅色三節列車沿木棧橋移動。

所有近景模型由 `scripts/build-taiwan-environment.py` 在 Blender 4.5 建構，沒有匯入外部素材。`art-source/taiwan-environment-v1.blend`／`taiwan-environment-low-v1.blend` 含十個具名可隔離的集合：arcade、stucco、tea、warehouse、station、gate、tower、cedar、crane、ocean。GLB 使用八個共享材質、頂點色及公尺尺度 UV；材質的磚、木、混凝土及金屬微表面沿用專案程序紋理。

標準資產共 14,488 三角形、1,348,740 bytes；省電資產共 7,724 三角形、739,472 bytes。數值是各模組一份的總和，不是場景面數；重複擺放及陰影會增加實際繪製量。

## 場景與效能策略

`src/game/track/taiwanArchitecture.ts` 集中描述原創模組的擺放，對主路、捷徑和旋轉橋做避讓。拱門／倉庫／木站的牆柱在護欄外，頂部跨越道路；GLB 的可穿行洞口另用射線測試驗證。新細節沒有被整份當成 Collider；碰撞仍由共同的正式路面及護欄決定。

`TaiwanArchitecture` 按模組／材質實例化。駕駛視角中，標準細節工作距離為 105 m，省電為 60 m；超出距離時以有地面樹幹的簡化林冠及街廓輪廓接續。全圖檢視只保留詳細地標和拱門，其餘採簡化形體。模型卸載只釋放自有材質和幾何，共享紋理與 GLB 快取保持可重用。

`taiwanTerrainShape` 共用切坡表面，樹幹依實際土面高度種植，根系以接回坡面的土肩承托；射線檢查比對渲染幾何與種植高度。`TaiwanTerrain` 建立連續切坡；`TaiwanPlatforms` 在台北屋頂、九份階地、高雄裙樓區建立低於正式路面的承托體，避開較低的交叉道路。`TaiwanSky` 提供近地平線至天頂的色彩層次，台北使用側向暮色光；海面層與路面留出深度距離，避免海水蓋住低路段。四圖增加遠景裁切距離，其他七圖保留原設定。

## 驗證與證據界線

`npm run check` 通過 52 檔／426 項；production build 成功。新增 GLB 八材質／有限 UV／洞口射線檢查、場景避讓及樹根對渲染土面的射線驗證。

Brave production 第一輪 25 項通過：四圖雙畫質載入／加速、四車與模擬手機橫向、車手雙畫質動畫／重賽、四圖 WebGL 編譯、八條主路／捷徑合法一圈、四圖大跳／旋轉／落地 Turbo、十一圖選圖、權威與練習旋轉港橋。最終精簡後，再通過九份主路八區完圈、阿里山主路八區完圈及阿里山大跳共 3 項。最後版本再通過四圖雙畫質、四車／模擬手機、車手動畫及四圖 WebGL 編譯共 10 項（2.6 分鐘）；沒有 pageerror 或 shader compilation error。

逐區實際遊戲截圖：[台北城門](../doc/images/track-redesign/taipei-drive-0.png)、[九份階地](../doc/images/track-redesign/jiufen-drive-2.png)、[高雄倉庫分流](../doc/images/track-redesign/kaohsiung-drive-1.png)、[阿里山風口](../doc/images/track-redesign/alishan-drive-5.png)。每圖八區及跳躍畫面另存於 `doc/images/track-redesign/`。最終材質檢視另存 [台北標準](../doc/images/track-redesign/taipei-standard.png)、[九份標準](../doc/images/track-redesign/jiufen-standard.png)、[高雄標準](../doc/images/track-redesign/kaohsiung-standard.png)、[阿里山標準](../doc/images/track-redesign/alishan-standard.png)、[四車](../doc/images/track-redesign/four-cars.png) 及 [模擬手機省電](../doc/images/track-redesign/mobile-low.png)。

最終四車起點場景：標準 359 calls／559,720 triangles；模擬手機省電 217 calls／195,316 triangles，兩者約 60 FPS、p95 16.8 ms。這是該場景的診斷樣本，不能推論真機效能。

最終省電四車整圈抽樣：九份最高 199,312 triangles／261 calls；阿里山最高 177,552 triangles／243 calls，末段約 60 FPS、p95 17.8–18.2 ms。精簡前台北最高 197,568 triangles／263 calls，高雄最高 156,768 triangles／311 calls。這些是每秒診斷抽樣，不是 GPU 逐幀最大值；道具、粒子與同時出現的車輛改變成本。基礎省電面數受控，但完整道具場景的 calls **尚未全面達成 250 目標**，不宣稱全圖全場達標。標準畫質含陰影的面數也高於非陰影參考預算；真機及最壞情況仍未驗收。`taipei-concept-v1.png` 是 AI 概念；`taipei-blender-v1.png` 是真實 Blender 模型的攝影棚渲染。遊戲截圖另外保存，不能以概念圖或攝影棚畫面代替 WebGL 結果。

這一輪完成模組與環境重製，沒有重畫已核准的可駕駛拓撲，也沒有新增列車橫越獨立支路等新的障礙行為。提案所稱的安全／獎勵側線在遊戲中沿用主路左右車道：列車／礦車在左側往返，右側可繞過；貨櫃在左側升降。阿里山跳台下方的列車與木橋為動態景物，不增加可駕駛道路或 Collider；其橋柱避開正式道路。台北捷運、港灣貨輪及森林列車皆沿車／船長軸移動，使用共用遊戲時間。

本地 Brave 與模擬手機尺寸不能代替實際手機、跨平台及長時間賽事驗收；概念圖的細節密度和主機遊戲美術水準仍是品質參考，不宣稱完全達成。尚未部署。
