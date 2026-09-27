# Kart Lab

以 Next.js App Router、TypeScript、React Three Fiber、Drei、Rapier 與 Colyseus 製作的原創 Web 3D Arcade Kart。Phase 3 已完成單一手機控制器的程式與自動驗收：Host 可建立房間與 QR Code，手機以觸控或可選的傾斜控制既有單人賽車，並具備輸入驗證、逾時歸零、重連與控制回饋 RTT。真實 iOS／Android 裝置的最終人工驗收仍待執行。

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

建立手機控制房間後，可按「收起 QR Code」縮小面板並繼續遊玩，手機連線會保留；按「顯示 QR Code」可再次邀請配對。只有「關閉房間」會結束連線。目前每房僅支援一支手機控制一台車，多人同場競賽屬於尚未實作的 Phase 4。

Host 鍵盤：

- `W`／`↑`：加速
- `S`／`↓`：煞車與倒車
- `A D`／`← →`：左右轉向
- `Space`：按住漂移；充能到三個等級之一後放開，觸發對應 Mini Turbo
- 「檢查賽道」：切換 OrbitControls，使用滑鼠旋轉、縮放及平移
- 「重新比賽」：結算後清除成績與增益，重新進入倒數

手機 Controller 提供 GAS、BRAKE、左右轉向、DRIFT，以及可選的傾斜轉向、校正與靈敏度。房間連上手機時，Host 只接受手機的 `KartInput`；Controller 離線、切到背景或 250 ms 沒有持續輸入時會歸零，短暫斷線可在 8 秒內重連。

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

2026-09-27 的 Phase 3 自動驗收結果：

- 13 個 Vitest files、52 個 tests：鍵盤／觸控／傾斜 adapter、Arcade 駕駛、三級漂移、碰撞、賽事規則、網路協定與 Colyseus Room 整合。
- 14 個 Chromium Playwright 情境：production Canvas／Rapier、倒數、三級漂移、無效衝線、護欄碰撞、重生保護、鍵盤實際三圈、貼地、路面接縫，以及多 Browser Context 的 QR 建房、直／橫向手機版面、感測器拒絕備援、房間額滿、手機輸入、控制回饋 RTT、斷線歸零、重連、關房與錯誤狀態。
- `npm run build` 的 Next.js production build 通過。

真實 iOS 與 Android 無法由目前的桌面自動化環境代驗。進入 Phase 4 前，仍需依 [roadmap](tech-doc/roadmap.md) 的 P3-T08 清單完成實機掃碼、一圈駕駛、直／橫向、鎖定／切 App、斷網重連、方向權限拒絕與不同網路延遲紀錄。

## 結構

- `src/game/core/kart`：無框架相依的 Arcade 駕駛與三級漂移規則。
- `src/game/core/race`：無 React／DOM 相依的狀態機、Checkpoint、圈數、進度、排名資料模型與重生規則。
- `src/game/input`：Keyboard、Touch、Tilt adapters，全部輸出相同 `KartInput`，不能直接改車體座標。
- `src/game/network`：Controller UI、endpoint、協定、Host room hook 與集中式網路參數。
- `src/game/components`：賽道、Checkpoint、卡丁車、鏡頭、特效、HUD、倒數、結算與 Host room UI。
- `src/game/physics`：Rapier 世界、卡丁車剛體、靜態賽道 Collider、Checkpoint Sensor 與輸入套用 acknowledgement。
- `src/game/track`：可調賽道參數、純中心線資料與共用幾何。
- `src/game/runtime`：物理、渲染與 React HUD 間的高頻狀態及低頻遙測。
- `server`：獨立 Colyseus process、健康檢查、單 Host／Controller 的 `RaceRoom` 與整合測試。

## Phase 3 邊界

目前仍是 Host 端單車 Rapier 模擬。沒有實作 Phase 4 的 2–4 人 Lobby、Ready、權威伺服器模擬、狀態快照／插值、玩家互撞或多人排名；道具與正式美術也維持在後續 Phase。
