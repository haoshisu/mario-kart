# Kart Lab

以 Next.js App Router、TypeScript、React Three Fiber、Drei、Rapier 與 Colyseus 製作的原創 Web 3D Arcade Kart。Phase 1～5 已完成；使用者於 2026-09-29 確認 Phase 5 人工驗證完成。Phase 6 的 P6-T01～T05 已完成本機實作與驗收，P6-T06～T09 部分實作；正式部署與跨裝置 RC 尚未完成。詳細紀錄見 `tech-doc/roadmap.md`。

## Phase 6 使用與部署

- 原創 Pulse 車輛／Pip 狐狸飛行員、風車花谷賽道（約 240 m、連續彎、選線加速帶、即時小地圖）；支援既有單人／多人模式。
- 遊戲內「畫質」可切換標準／省電；網址加 `stats=1` 顯示本機渲染診斷，不能視為 Windows／iPhone 效能保證。
- 已核准 `mario-kart.sshnick.com`（Vercel Hobby）＋Render Free（同時一房四人）；Cloudflare 只調整遊戲子網域。冷啟動最多等待九十秒，可取消／重試；伺服器重啟需重新建房。
- [美術規範](tech-doc/art-direction.md)、[部署／RC 手冊](tech-doc/deployment.md)。雲端設定檔尚未代表實際部署或 CI 通過。
- 最新本機結果：lint、typecheck、119 項測試及 build 通過；production Brave 的完整 28 項瀏覽器驗收通過，涵蓋 3D／物理／多人／CPU／故障恢復。這不代替 Windows／iPhone／Android 真機與正式網址驗收。

## 本機啟動

先安裝套件，再分別啟動獨立 Colyseus server 與 Next.js：

```bash
npm install
```

```bash
npm run server:dev
```

```bash
npm run dev:network
```

Host 開啟 [http://localhost:3000/game](http://localhost:3000/game)。建立房間後，QR Code 會使用 Host 頁面的 origin；同一 Wi-Fi 的手機需掃描以電腦區域網路 IP 開啟的 Host 頁面，例如 `http://192.168.1.107:3000/game`，並能連到電腦的 `3000`、`2567` ports。

開發模式會將本機網卡的 IPv4 位址加入 Next.js `allowedDevOrigins`，讓區域網路 IP 頁面能完成互動初始化。切換 Wi-Fi 或 IP 改變後，請重啟 `npm run dev:network` 以更新允許的位址。

預設 Colyseus endpoint 會沿用目前頁面的 hostname 並使用 port `2567`。分開部署或使用 HTTPS 時，需在 build 前指定公開的 HTTPS／WSS 對應端點：

```bash
NEXT_PUBLIC_COLYSEUS_URL=https://socket.example.com npm run build
npm start -- -H 0.0.0.0 -p 3000
```

```bash
COLYSEUS_HOST=0.0.0.0 COLYSEUS_PORT=2567 npm run server:start
```

手機觸控不依賴方向感測器；傾斜控制則依瀏覽器政策可能要求 HTTPS，且 iOS 會在使用者點擊「啟用傾斜」後請求權限。權限拒絕時仍可使用左右觸控鍵。

## 操作與賽事規則

若 IP 頁面只顯示外框、按鈕無反應，且開發日誌出現 `Blocked cross-origin request`，可在 `.env.local` 明確設定 `DEV_ALLOWED_ORIGINS=192.168.1.123`（換成電腦目前 IP，多個 hostname 用逗號分隔，不含協定與 port），再重啟 `npm run dev:network` 並重新整理頁面。此設定會與自動偵測的網卡 IPv4 合併；IP 改變時也要更新此值。

`/game` 會先顯示多人建房等待畫面，建立房間、玩家加入並 Ready 後，由 Host 按「開始比賽」才倒數。關房或連線失敗不會自動切回單人賽事。單人鍵盤練習可開啟 `/game?mode=solo`。

建立多人賽事房間後，可按「收起 QR Code」縮小面板並繼續遊玩，按「顯示 QR Code」再次邀請玩家。每房支援 2～4 位電腦或手機玩家（含參賽房主）；玩家輸入暱稱、選擇未占用的車色並 Ready，所有已連線玩家準備完成後由 Host 開始。只有「關閉房間」會主動結束整個 Room。

Host 鍵盤：

- `W`／`↑`：加速
- `S`／`↓`：煞車與倒車
- `A D`／`← →`：左右轉向
- `Space`：按住漂移；充能到三個等級之一後放開，觸發對應 Mini Turbo
- 「檢查賽道」：切換 OrbitControls，使用滑鼠旋轉、縮放及平移
- 「重新比賽」：結算後清除成績與增益，重新進入倒數

手機 Controller 提供 GAS、BRAKE、左右轉向、DRIFT，以及可選的傾斜轉向、校正與靈敏度。手機只傳送帶序號的 `KartInput`；Node.js 伺服器以固定 60 Hz 決定車輛位置、Rapier 碰撞、Checkpoint、圈數與結果，再以 20 Hz 廣播快照。Controller 離線、切到背景或 250 ms 沒有持續輸入時會歸零，短暫斷線可在 8 秒內保留席位，逾時則在比賽中標記 DNF。

倒數完成前車輛鎖定；比賽開始後必須依序通過三個 Checkpoint，再以正向通過起終點才算一圈。預設三圈完成，賽事時間即鎖定。跳過 Checkpoint、逆向衝線或重複壓線都不會增加圈數。出界、翻車或持續卡住會回到最近有效 Checkpoint，並有短暫輸入／碰撞保護。

## 驗證

```bash
npm run check
npm run build
npm run test:e2e
```

`npm run check` 包含 oxlint、TypeScript 與 Vitest；伺服器整合測試會暫時開啟本機 loopback port。Playwright 會啟動 production Next.js 與獨立 Colyseus server，預設使用已安裝的 Chromium；也可指定現有 Chromium：

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="/path/to/chromium" npm run test:e2e
```

2026-09-28 的 Phase 4 自動驗收結果：

- 22 個 Vitest files、75 個 tests：既有鍵盤／觸控／傾斜、Arcade 駕駛、漂移、碰撞與賽事規則，加上協定版本、每玩家輸入隔離、公平倒數、單調遞增 tick、Node Rapier 車輛／護欄碰撞及減速同步、四人三圈同 tick 完賽、權威排名、插值／受限外插、輸入排送、共享鏡頭取景、Colyseus 2～4 人整合，以及 6 個四人 Room／30 條 WebSocket 的 20 Hz 負載。
- 17 個 Chromium Playwright 情境：保留 production Canvas／Rapier、三級漂移、無效衝線、護欄碰撞、重生、鍵盤三圈、貼地與路面接縫回歸；另以 Host + 2／3／4 個獨立行動裝置 Browser Context 驗證選色、滿房錯誤、Ready、倒數、輸入隔離、多人 3D、共享鏡頭、權威 DNF 結算、賽後席位清理、Host 重整／斷網重連與手機斷網重連／逾時。兩車相隔超過 25 m 時，寬版與窄版畫面均保留名牌；本機視覺輸入反應量測為 92 ms，不代表真機跨網路延遲。
- `npm run build` 的 Next.js production build 通過。

Phase 3 的真實 iOS／Android 驗收已完成；Phase 4 真實手機驗收也由使用者確認通過。
逐案例操作與通過條件記錄於 [`tech-doc/roadmap.md`](tech-doc/roadmap.md) 的「Phase 4 真實裝置驗收執行表」。

## 結構

- `src/game/core/kart`：無框架相依的 Arcade 駕駛與三級漂移規則。
- `src/game/core/race`：無 React／DOM 相依的狀態機、Checkpoint、圈數、進度、排名資料模型與重生規則。
- `src/game/input`：Keyboard、Touch、Tilt adapters，全部輸出相同 `KartInput`，不能直接改車體座標。
- `src/game/network`：多人 Controller UI、endpoint、版本化協定、快照插值、Host room hook 與集中式網路參數。
- `src/game/components`：賽道、Checkpoint、單機／多人卡丁車、跟隨／共享鏡頭、HUD、倒數、結算與 Lobby UI。
- `src/game/physics`：Rapier 世界、卡丁車剛體、靜態賽道 Collider、Checkpoint Sensor 與輸入套用 acknowledgement。
- `src/game/track`：可調賽道參數、純中心線資料與共用幾何。
- `src/game/runtime`：物理、渲染與 React HUD 間的高頻狀態及低頻遙測。
- `server`：獨立 Colyseus process、健康檢查、2～4 人 `RaceRoom`，以及權威 Rapier Simulation、Input、Collision、Ranking systems 與整合／負載測試。

## Phase 5 開發邊界

### 單人對戰（核准擴充）

首頁選「單人挑戰電腦」，或開啟 `/game?mode=bots`：

- 「單人對戰・鍵盤」：開始比賽後使用 WASD／方向鍵、Space 漂移、E 或 ITEM 按鈕使用道具。
- 「單人對戰・手機」：一支手機掃碼加入、選色及準備，再由 Host 開賽。
- 兩種模式均為 1 位真人＋3 位電腦，採相同三圈、道具、碰撞、排名、重賽規則；建房後不切換操作來源。仍需同時啟動 Next.js 與 Colyseus，並非離線模式。
- 單人對戰使用玩家車尾追蹤視角（鍵盤／手機皆同），不會因 CPU 分散而拉遠；多人參賽裝置也使用自己的跟車視角，只有觀賽 Host 使用全場共用鏡頭。
- 電腦採單一難度基礎循線與低速車避讓，設定在 `server/systems/botConfig.ts`；不以瞬移、圈數捷徑或橡皮筋加速追趕，卡住時僅依共用規則重生。`/game?mode=solo` 保留無對手鍵盤練習。
- 驗證：lint／typecheck／build、103 項規則與連線測試通過；24 個瀏覽器情境已取得通過結果（完整回歸 23 項＋修正測試查詢後單獨重跑手機情境）。詳細紀錄見 roadmap；真人平衡與真實手機驗收不以自動測試代替。

多人位置、碰撞、Checkpoint、圈數、排名、道具與結果均由伺服器權威決定；所有玩家裝置渲染快照，並只送標準化輸入及道具使用請求。Phase 5 採原創加速、一次防禦護盾、地面陷阱與少量加速帶，規則與調校值集中於 `src/game/core/items/`。核心測試及瀏覽器中的手機 ITEM、2／3／4 人三圈道具賽、統一排名、同房重賽與漂移回饋已通過；真人多人平衡、音效聽感與真機操作由使用者於 2026-09-29 確認驗證完成。可選跳台未加入；正式美術／部署屬接下來的 Phase 6。

手機駛過道具箱後，按獨立的 ITEM 鍵使用。Host 可按「啟用音效」播放原創合成回饋，並調音量或靜音。首位完賽後有 30 秒等待期限，逾時者為 DNF；Host 結算後可直接同房重賽，或返回 Lobby 重新準備。


### 每人獨立畫面（2026-09-30）

- 建立多人房間時預設勾選「房主直接參賽」，房主佔一席並自動準備；朋友開啟「開啟／分享玩家連結」或掃碼加入。取消勾選可保留原本的觀賽 Host。
- `/controller/[roomId]` 現在顯示玩家自己的 3D 跟車畫面，預設省電畫質。手機使用疊加的觸控按鈕，橫向／直向皆可操作；電腦可切換鍵盤操作。
- 房主也可切換觸控操作。最多四位參賽者；開賽、重賽與關房權限仍屬房主。
- 鏡頭依自己的連線玩家 ID 選車；重連保留身分。手機 3D 的真實 iPhone／Android 效能需重新驗收，先前「手機僅為控制器」的驗收不涵蓋這項變更。

本次改動的回歸包含 `npm run check`（120 項測試）、production build、每人獨立視角與手機橫直向操作，以及 2／3／4 人完整三圈與同房重賽。長賽程瀏覽器測試使用 `?e2e=1` 開啟唯讀快照觀察，再送出鍵盤／觸控事件；不修改伺服器位置或成績。

### 新增進攻道具（2026-10-01）

道具箱現在等機率抽出五種原創道具。新增「直射飛盤」向車頭發射、「追蹤光球」鎖定前方近處對手（無目標時直射）；兩者撞護欄會消失，護盾可抵擋，命中沿用短暫旋轉及恢復保護。手機按 ITEM、鍵盤按 E 使用。協定升為 5，需同步更新前端與 Colyseus 伺服器。

### 風車花谷賽道改版

路線從橢圓改為大弧彎與左右連續彎，路寬 8.4 m，場景加入湖畔、風車與村落。小地圖顯示自己／對手位置、終點及加速帶。路線與道具座標由前後端共用；目前協定為 **6**，需同步更新前端與 Colyseus 伺服器，舊版地圖客戶端不能混用。立體坡道與分岔捷徑尚未實作。
