# Web 3D 多人卡丁車遊戲

## 企劃暨技術設計文件

> 實作狀態（2026-09-29）：Phase 1～5 已完成，Phase 5 人工驗證由使用者確認。Phase 6 開發中：原創 Blender／GLB、場景裝飾、畫質與診斷、冷啟動、容量／來源檢查及部署／CI 設定已加入。正式帳號部署、Windows／iPhone 四人與完整跨平台效能驗收尚未完成，不以本機測試代替公開上線驗收。

## 1. 專案目標

打造一款類似 Mario Kart 遊玩體驗的 Web 3D 多人卡丁車遊戲。

主要特色：

- 網頁直接遊玩，不需安裝 App
- 3D 卡丁車、3D 賽道與完整場景
- Arcade 風格駕駛手感
- 漂移、碰撞、加速、道具
- 每位玩家的電腦或手機各自顯示 3D 遊戲與個人跟車視角
- 電腦使用鍵盤；手機同時顯示賽道與觸控操作
- 支援多人 Room
- QR Code 快速加入
- 支援不同地點的朋友透過房間連結進行網路對戰

不直接使用 Nintendo / Mario 相關角色、模型、音效或素材，改為原創 IP。

---

# 2. 核心遊戲流程

```text
Host 開啟遊戲
      ↓
建立 Room
      ↓
畫面顯示 Room Code + QR Code
      ↓
朋友開啟連結或掃描 QR Code
      ↓
輸入名稱 / 選角色 / 選車
      ↓
Ready
      ↓
全部玩家準備完成
      ↓
3、2、1、GO
      ↓
比賽
      ↓
計算排名
      ↓
結果畫面
      ↓
重新開始 / 下一場
```

---

# 3. 遊戲畫面架構

2026-09-30 核准改為每人獨立遊戲畫面，不要求共看 Host 螢幕。

- 房主預設直接參賽，佔用四人上限中的一席，建房後等待朋友加入、Ready，再開始比賽。
- 玩家開啟分享連結或 QR Code，在自己的電腦／手機選暱稱、車色並準備。
- 所有參賽裝置各自渲染同一份權威賽事狀態，第三人稱鏡頭跟隨自己的玩家 ID。
- 電腦可使用 WASD／方向鍵、Space 漂移、E 道具；手機同時顯示 3D 畫面和方向、油門、煞車、漂移與道具按鈕，建議橫向，直向仍可操作。
- 加入頁保留傾斜操作；鍵盤與觸控可明確切換，切換、離開與背景化清空輸入。
- 保留取消「房主直接參賽」的既有共用螢幕／觀賽建房方式；參賽玩家仍有自己的畫面。
- 舊 `/controller/[roomId]` 連結沿用，但內容已是玩家遊戲頁，不再只是遙控器。

---

# 4. 技術架構

## Frontend

```text
React
TypeScript
Next.js App Router
React Three Fiber
Three.js
@react-three/drei
```

用途：

- UI
- 3D 場景
- 車輛
- Camera
- 賽道
- 特效
- Game HUD

---

## Physics

使用：

```text
Rapier
```

負責：

- Collision Detection
- Rigid Body
- Collider
- Trigger / Sensor
- 重力

不依賴 React 的 TypeScript Arcade Core 負責：

- 加速、煞車、阻力與速度限制
- 轉向、側向抓地力與漂移
- Mini Turbo 與撞牆反應參數

但遊戲不追求真實汽車物理。

主要採用：

```text
Arcade Physics
```

---

# 5. Kart Driving System

Kart 核心狀態：

```ts
KartState {
  speed
  steering
  acceleration
  drifting
  grounded
  boost
  position
  rotation
}
```

核心行為：

```text
Acceleration
Brake
Steering
Drift
Mini Turbo
Boost
Jump
Collision
Spin Out
Respawn
```

---

# 6. Arcade Physics

目標不是模擬真實汽車，而是做出類似 Mario Kart 的操作感。

例如：

```text
Acceleration
↓
增加 Forward Velocity

Steering
↓
控制 Yaw Rotation

Drift
↓
降低側向 Grip

Drift Time
↓
累積 Mini Turbo

Release Drift
↓
Boost
```

車輛不需要精準模擬：

```text
輪胎
懸吊
馬力
扭力
變速箱
```

遊戲感優先。

---

# 7. Collision System

權威伺服器的固定高度駕駛將紅白路緣視為可通行的視覺路面，不建立阻擋車體的凸起路緣碰撞面，避免沿路緣行駛或跨越時被卡停。護欄與車輛碰撞仍由 Rapier 處理，保留撞牆減速與受擊回饋；舊版單人練習的貼地支撐不受此調整影響。

卡丁車使用 60 Hz 固定物理步進與 0.5 單位的 Soft CCD 預測接觸，避免 Hard CCD 在平坦三角網格接縫截短位移、造成定速時忽快忽慢。路緣支撐除四角探測外也包含前後保險桿中心，讓彎曲路緣不會落在探測盲區。

碰撞分為幾種類型。

## Kart → Wall

效果：

```text
碰撞
↓
小幅反彈
↓
降低速度
↓
車體晃動
```

例如：

```text
Speed × 0.7
```

---

## Kart → Kart

效果：

```text
兩台車碰撞
↓
互相推開
↓
短暫速度降低
↓
車身偏移
```

不模擬真實車體變形。

---

## Heavy Collision

高速撞擊：

```text
Collision
↓
Spin Out
↓
短暫失去控制
↓
恢復駕駛
```

---

## Item Hit

例如被攻擊型道具擊中：

```text
Hit
↓
Spin Animation
↓
Speed = 0 / Slow
↓
Disable Control
↓
Recover
```

---

# 8. Drift System

漂移為核心玩法之一。

流程：

```text
按住 Drift
      ↓
Kart 進入 Drift
      ↓
方向控制改變
      ↓
累積 Drift Energy
      ↓
放開 Drift
      ↓
Mini Turbo
```

Phase 2 已實作三個可調階段：

```text
Level 1
小 Boost

Level 2
中 Boost

Level 3
大 Boost
```

搭配：

- 輪胎煙霧
- 火花
- 車體傾斜
- 音效

目前充能門檻、持續時間、加速度、最高速、顏色與文字標籤集中於 `kartConfig.ts`。HUD 的三格能量、輪後火花與 Turbo 火焰會依 Level 1／2／3 顯示青、紫、黃綠回饋；重賽與重生會清除不應保留的速度與漂移增益。音效仍留在後續內容階段。

---

# 9. Race System

每條賽道包含：

```text
Start Line
Checkpoint 1
Checkpoint 2
Checkpoint 3
...
Finish Line
```

玩家必須依順序通過：

```text
CP1
↓
CP2
↓
CP3
↓
Finish
```

才能算完成一圈。

避免：

```text
起點
↓
直接迴轉
↓
終點
```

作弊。

Phase 2 的單人賽事狀態為 `IDLE → COUNTDOWN → RACING → FINISHED`。Rapier 中有對齊賽道的 Sensor 體積，規則核心另以固定步長的掃掠線段判定前後方向，避免高速穿越漏判。只有依序通過三個 Checkpoint 並正向穿越起終點才會增加圈數；同一線重複進出、跳點或逆向穿越均無效。

預設倒數三秒、比賽三圈。倒數期間鎖定車輛，進入 `RACING` 後才開始計時；完成後鎖定總時間與各圈成績。出界、翻車或持續卡住會回到最近有效 Checkpoint，保留已驗證進度並提供短暫輸入／碰撞保護。

---

# 10. Ranking System

排名依據：

```text
Lap
+
Checkpoint
+
Distance To Next Checkpoint
```

而不是單純比較座標。

例如：

```text
Player A

Lap 2
Checkpoint 5


Player B

Lap 2
Checkpoint 4
```

Player A 排名較前。

Phase 2 已提供單人進度與可重用的 `RacerProgress` 排序介面。排序值由已完成圈數、最後合法 Checkpoint 區段與該區段的中心線投影組成；原始座標即使跨到更後方賽段，也不會越過尚未通過的 Checkpoint 上限。真正的多人名次顯示仍屬 Phase 4。

---

# 11. Multiplayer Architecture

Backend：

```text
Node.js
TypeScript
Colyseus
WebSocket
```

架構：

```text
各玩家裝置（畫面＋Input）
      ↓
WebSocket
      ↓
Game Server
      ↓
Room
      ↓
Player Input
      ↓
Game State
      ↓
所有玩家各自渲染遊戲
```

Colyseus 服務以獨立常駐 Node.js process 執行，不放在 Next.js Serverless Route。Phase 4 起由伺服器以固定 60 Hz 執行共用 Arcade Core 與 Rapier，20 Hz 廣播權威快照；各玩家裝置只做插值渲染與 UI，不接受客戶端座標、圈數或成績。協定版本、輸入頻率、快照頻率、外插上限與重連窗口集中於 `networkConfig.ts`。

---

# 12. Room System

Phase 4 Room：

```text
9 位隨機 Colyseus Room ID
```

資料：

```ts
Room {
  roomId
  hostConnection
  phase
  players[2..4]
  canStart
}
```

Player：

```ts
Player {
  sessionId
  role: "host" | "controller"
  nickname
  color
  ready
  connection
  raceStatus
}
```

每個多人房間最多四位參賽者（包含參賽 Host）。新建房預設 Host 參賽；協定 `hostPlays` 明確控制 Host 是否擁有自己的車，省略時相容原觀賽 Host。參賽 Host 自動 Ready，返回 Lobby 時保持 Ready。Lobby 中玩家可選暱稱與唯一車色並切換 Ready；所有已連線玩家準備完成且至少兩人時，只有 Host 能開始。Host 可主動關房；Host 離開或重連逾時時房間釋放。客戶端重試涵蓋 heartbeat 偵測上限（3 秒 × 3 次）及席位保留時間，避免比伺服器更早放棄；Controller 由伺服器判定斷線後保留 8 秒席位並立即中立化輸入，逾時則在比賽中標記 DNF、在 Lobby 釋放席位。

---

### 核准擴充：單人對戰（2026-09-28）

使用者核准新增「1 位真人＋3 位電腦」及鍵盤／手機兩種操作，不屬 Phase 6。建房時選擇 `multiplayer`、`solo-keyboard` 或 `solo-phone`，房間內不切換操作來源。多人規則不變；單人鍵盤由 Host 連線擁有唯一真人車（WASD／方向鍵、Space 漂移、E 或 ITEM 按鈕使用道具），單人手機由一位 Controller 掃碼加入並 Ready。兩者均由 Host 開賽；額外 Controller 不可加入單人房。鍵盤單人仍需現有 Node／Colyseus 伺服器，不是離線模式。`/game?mode=bots` 提供單人對戰入口；`/game?mode=solo` 保留原本無對手練習。

`server/systems/BotDriver.ts` 以賽道取樣點產生標準化 throttle／brake／steer 輸入，使用前視循線、彎道／受擊後減速與低速車避讓，並定期透過相同道具使用規則使用背包。單一難度，參數集中於 `botConfig.ts`；不加入機器學習、複雜戰術、多難度或橡皮筋追趕。電腦不能直接設定位置、圈數或排名，與真人共用 Arcade／Rapier、Checkpoint、碰撞、受擊、卡住重生及三圈／30 秒完賽等待規則。CPU 席位不佔 WebSocket 連線，重賽保留三位對手；單人手機在 Lobby 離開時清空 CPU，供替代玩家重新加入。Host 離開關房，鍵盤 Host 重連期間輸入歸零，重連後保留玩家身分並重設輸入序號。協定版本為 4，房間狀態新增模式及 CPU 標記。

---

# 13. 玩家裝置與輸入

單人對戰驗證：lint、typecheck、build、103 項規則／連線測試及 24 個瀏覽器情境已取得通過結果，詳細分次執行紀錄見 roadmap 的「核准擴充：單人對戰」。真人離開後不可只由 CPU 重賽；返回 Lobby 會清理無真人的單人手機房席位。上述自動驗收不代替 Phase 5 真人平衡與真實手機操作驗收。

手機主要傳送：

```ts
{
  throttle: 1,
  brake: 0,
  steer: -0.5,
  drift: true
}
```

而不是直接傳：

```ts
position: {
 ;(x, y, z)
}
```

也就是：

```text
Controller 傳 Input

Server / Game
決定 Kart 怎麼移動
```

觸控輸入以 20 Hz 傳送，封包帶有遞增序號與手機送出時間；伺服器會驗證角色、數值範圍、順序與傳送頻率。權威伺服器接受封包後回傳包含 server tick 的 acknowledgement，手機計算控制 RTT，再回報 Host 顯示。250 ms 未收到持續輸入時，伺服器直接將該玩家輸入歸零。

---

# 14. Network Synchronization

多人遊戲需要處理：

```text
Latency
Packet Delay
Jitter
Position Sync
```

房間同步 tick 在大廳、倒數、比賽與重賽間持續遞增，開賽只重設賽事計時，不歸零同步序號，避免快照廣播及客戶端排序中斷。

Phase 4 的顯示插值等待為 50 ms；手機保持 20 Hz 心跳，觸控／傾斜變更另即時排送，最短間隔 35 ms，合併間隔內的最新輸入以遵守伺服器限流。

Phase 4 已加入：

```text
Snapshot Interpolation
Bounded Extrapolation
Teleport Snap
```

第一版同步策略：

```text
Input Sync
+
Authoritative State Sync
```

即可。

---

# 15. Camera System

每位參賽玩家使用 `NetworkFollowCamera`，依連線玩家 ID 選擇自己的車，不依排名或陣列順序。所有車體與鏡頭讀取同一個 `SnapshotBuffer`，50 ms 插值與有限外插保持一致。距離 7、高度差 2.8、前視距離 3.2 集中於 `core/camera/chaseCamera.ts`；受擊旋轉期間保持方向，重生與重賽重設鏡頭。

`Game.tsx` 擁有 Host 與玩家頁的 Canvas 及場景組合，兩者共用 `MultiplayerScene`；手機玩家頁預設 DPR 1 並關閉陰影，可切換標準畫質。觀賽 Host 保留共用取景，單人手機模式的 Host 保留追蹤唯一真人。原本無對手練習維持原有鏡頭。

---

# 16. Item System

原創道具包含「脈衝推進」（Boost）、「光環護盾」（一次防禦）、「旋流陷阱」（地面攻擊），以及 2026-10-01 使用者核准新增的「直射飛盤」（Disc）與「追蹤光球」（Orb）。不實作真實車體損傷；下列清單的其他種類仍為未來構想。

道具核心位於 `src/game/core/items/`，由伺服器 `SimulationSystem` 執行；場景與伺服器共用拾取點／加速帶座標。每人只能持有一件，掉落採等機率、支援固定種子的亂數；道具箱冷卻 5 秒，使用冷卻 0.65 秒。使用請求僅帶背包 revision，控制權由連線身分決定；重複、過期及非比賽中的請求均拒絕。協定現為版本 6（風車花谷路線、路寬與道具位置更新；拒絕舊地圖客戶端，前端與伺服器需一起更新）。

飛盤向車頭直射；光球在發射時鎖定 26 m 內、前方視野且未被護欄阻擋的最近對手，轉向速率有限。無目標或目標失效時直射，不重新鎖定。速度 28 m/s、最多存在 4 秒、全房最多 12 發；伺服器對移動對手與護欄做掃掠命中，先撞到護欄就消失，排除發射者、非比賽及離線玩家，單發只命中一次。護盾與恢復保護同樣能抵擋；離場／重生／重賽清除相關飛行道具。客戶端以快照插值呈現原創金色飛盤與青色光球，不能指定命中目標或位置。

Boost 持續 2 秒、Shield 最多持續 8 秒且擋一次攻擊、Trap 延遲 0.5 秒啟動並於 12 秒後消失。攻擊造成 0.8 秒控制鎖定，之後另有 1.8 秒恢復保護；護盾可與加速並存，真正命中會取消加速。伺服器以掃掠距離處理高速拾取／命中，先處理攻擊再處理拾取與加速帶；同 tick 競爭按玩家 ID 排序。斷線、重生及完賽清除道具狀態，重生提供保護；重賽清空世界但保留遞增 revision 以拒絕舊指令。

權威事件包含 `pickup/use/hit/immune/boost/respawn`，帶遞增 ID、tick、玩家、來源及位置；保留最近 2 秒且最多 64 筆供客戶端去重播放回饋。手機 ITEM 獨立於方向鍵，Host／手機顯示持有道具、冷卻、效果時間與攻擊來源。`ItemWorld` 使用共用座標繪製箱子、加速帶與最多 12 個陷阱；`MultiplayerKartEffects` 使用固定數量幾何呈現煙霧、火花、加速尾焰、護盾和撞擊閃光（護欄橙色、互撞白色、道具紫色）。少量 Boost Pad 已有規則，可選跳台暫不加入。

Host 音效由 Web Audio 原創合成，必須點擊「啟用音效」才建立 AudioContext；可調音量、靜音，最多同時 12 個聲部。涵蓋倒數、起跑、完賽及道具／碰撞事件，重複快照不重播事件。聲音與幾何回饋均不參與權威判定。

第一位玩家完賽後，其餘玩家有 30 秒完成比賽，逾時標記 DNF 但保持連線，顯示共同排名。完賽／DNF 車輛停止並取消實體阻擋，避免堵住後方車輛。Host 可「再玩一次」直接使用仍連線玩家啟動新的倒數（至少兩人且無待重連玩家），或「返回 Lobby」重新準備；重賽重設圈數、計時、背包與場景道具，不更換 Room。

例如：

```text
Rocket
Shield
Boost
Ice
Magnet
Trap
```

Item Box：

```text
Kart
↓
碰撞 Item Box
↓
Random Item
↓
玩家按 ITEM
↓
使用道具
```

---

# 17. 3D Asset Pipeline

Phase 6 的可重建資產腳本為 `scripts/build-models.py`，使用官方 Blender 4.5.11 LTS，輸出 `art-source/` 原始場景及未壓縮 GLB、`public/models/` Draco 壓縮 GLB。原創 Pulse 卡丁車與 Pip 狐狸飛行員共用車色材質，輪胎與車身分離，以既有車輪位置／半徑對齊物理。`game/assets/KartModel.tsx` 載入共用幾何，每車只複製改色材質並在卸載時釋放；轉向、滾動、傾斜、受擊及完賽歡呼由遊戲狀態驅動，不反向改變權威模擬。

Draco 解碼器取自既有 Three.js 套件，部署於 `/draco/`，附 Apache 2.0 授權，不依賴外部 CDN；原創模型無外部紋理，無須新增紋理壓縮依賴。材質、模型及場景預算見 `tech-doc/art-direction.md`。場景增添草丘、拱門、看台及方向牌。2026-10-02 核准賽道改版後，中心線、Collider、Checkpoint 與場景一起更新為風車花谷，見下方核准擴充。

建模工具：

```text
Blender
```

輸出：

```text
GLTF / GLB
```

Asset：

```text
kart.glb

character.glb

track.glb

tree.glb

building.glb

item-box.glb
```

流程：

```text
Concept
↓
Model
↓
UV
↓
Texture
↓
Rig
↓
Animation
↓
GLB
↓
Three.js
```

---

# 18. 美術風格

建議：

```text
Stylized
Low Poly
Cartoon
Arcade
```

避免追求：

```text
Photorealistic
```

原因：

- Web GPU 負擔較低
- 開發速度快
- 比較容易維持一致風格
- 更適合卡丁車玩法

---

# 19. Performance

單人 3D 場景以 React memo 隔離 HUD 遙測；多人高頻快照存放於 `SnapshotBuffer` ref，不以每個網路 frame 觸發 React 場景重繪。Canvas 的裝置像素比上限為 1.5。多人車體以 50 ms 插值延遲取樣，限制外插為 100 ms，跨越 5 m 的伺服器修正直接 snap；共享鏡頭依非 DNF 玩家的包圍範圍、視角與畫面比例計算距離，使用集中設定的最小距離及留白，分散時立即拉遠、靠攏時平滑拉近。超出可讀距離的玩家在排名 HUD 顯示「離群」。伺服器物理、碰撞與賽事判定維持固定 60 Hz，快照以 20 Hz 廣播。

主要需要注意：

```text
Draw Calls
Polygon Count
Texture Size
Animation
Physics
WebSocket
Multiple Cameras
Particles
```

可使用：

```text
LOD

Mesh Instancing

Texture Compression

GLTF Compression

Lazy Loading
```

---

# 20. 專案架構

```text
src/

game/
├── components/
│   ├── Kart.tsx
│   ├── Track.tsx
│   ├── FollowCamera.tsx
│   ├── DriftEffects.tsx
│   ├── GameHud.tsx
│   ├── RaceHud.tsx
│   ├── Countdown.tsx
│   ├── FinishScreen.tsx
│   ├── RaceMarkers.tsx
│   ├── PlayerKart.tsx
│   ├── SharedCamera.tsx
│   ├── MultiplayerScene.tsx
│   └── MultiplayerHud.tsx
│
├── core/
│   ├── kart/
│   │   ├── kartPhysics.ts
│   │   ├── driftSystem.ts
│   │   └── kartConfig.ts
│   ├── collision/
│   │   └── collisionSystem.ts
│   └── race/
│       ├── raceStateMachine.ts
│       ├── raceEngine.ts
│       ├── checkpointSystem.ts
│       ├── lapSystem.ts
│       ├── progressSystem.ts
│       ├── respawnSystem.ts
│       ├── raceTrack.ts
│       └── raceConfig.ts
│
├── physics/
│   ├── PhysicsWorld.tsx
│   ├── KartBody.tsx
│   ├── TrackColliders.tsx
│   └── RaceSensors.tsx
│
├── input/
│   ├── keyboard.ts
│   ├── useKeyboardInput.ts
│   ├── touchInput.ts
│   └── tiltInput.ts
│
├── network/
│   ├── MobileController.tsx
│   ├── endpoint.ts
│   ├── networkConfig.ts
│   ├── protocol.ts
│   ├── interpolation.ts
│   └── useHostRoom.ts
│
├── track/
│   ├── trackConfig.ts
│   ├── trackPath.ts
│   └── trackGeometry.ts
│
├── runtime/
│   ├── kartRuntime.ts
│   └── raceRuntime.ts
│
└── Game.tsx
```

Phase 4 獨立 Server：

```text
server/
├── createGameServer.ts
├── index.ts
├── rooms/
│   └── RaceRoom.ts
├── state/
│   └── roomState.ts
└── systems/
    ├── SimulationSystem.ts
    ├── InputSystem.ts
    ├── CollisionSystem.ts
    └── RankingSystem.ts
```

`RaceRoom` 負責連線生命週期、Lobby 與協定權限；`SimulationSystem` 擁有 Node 端 Rapier world、賽道靜態碰撞體、玩家剛體與 Race Core；輸入、碰撞反應及排名規則分離為可測試系統。客戶端不具備寫入多人位置或結果的訊息。

---

# 21. 開發階段

## Phase 1

單人 Prototype。

完成：

```text
3D Track
Kart
Keyboard
Acceleration
Steering
Brake
Camera
Collision
Basic Drift
Single-tier Mini Turbo
Speed HUD
```

---

Phase 1 建立的駕駛基礎：一般轉向快速消除側滑；達到最低速度後，按住方向鍵與 Space 進入漂移，側滑角度受限以避免持續累積橫向速度。輪胎保持水平，僅車身傾斜。四輪下方的路面偵測維持貼地，消除路緣碰撞造成的向上衝量；護欄不作為地面，附近沒有路面時保留重力下落。車體與追蹤鏡頭共用平滑後的水平顯示位置，鏡頭轉向另外使用短時間阻尼。原本的單階 Mini Turbo 已在 Phase 2 升級為三級充能。

## Phase 2

完成：

```text
Race State Machine
3, 2, 1, GO
Advanced three-tier Drift
Advanced Mini Turbo feedback
Checkpoint
Lap
Ranking
Respawn
Race HUD
Finish Screen + Restart
```

Phase 2 賽事核心完全以純 TypeScript 實作，不依賴 React 或 DOM。R3F 元件只顯示狀態，Rapier 整合只在固定步長讀取位置／碰撞並套用重生。實際鍵盤回饋控制器已在 production Brave 中連續跑完三圈；無效衝線、重生保護、三級漂移、結算與重賽另有 Vitest／Playwright 回歸測試。

---

## Phase 3

手機控制器與單一配對房間：程式、自動驗收與真實 iOS／Android 裝置人工驗收均已完成。

完成：

```text
QR Code
Room Code
WebSocket
Mobile Controller
Touch Control
Optional Tilt Control
Disconnect Reset + Reconnection
Input-to-Physics Feedback RTT
```

Phase 3 維持單一車輛與 Host 端 Rapier 模擬；未加入 Lobby、Ready、多車、玩家互撞、權威伺服器模擬或多人排名。

---

## Phase 4

多人起跑採 2～4 台車橫向單排、以賽道中心對稱排列，所有車輛與起跑線等距；加入、離開、重賽回大廳及正式開賽均使用同一排列規則。車輛名牌顯示於遊戲 HUD／房間面板之下，且不攔截操作。

`/game` 預設進入多人建房等待畫面，不啟動單人模擬或倒數；建房後由玩家加入及 Ready，再由 Host 開始比賽。關房或連線失敗維持多人等待畫面。原有單人練習改由 `/game?mode=solo` 明確進入。

2～4 人即時多人賽車：程式、自動驗收及真實手機人工驗收均已完成；真機由使用者於 2026-09-28 確認。

完成：

```text
2～4 Players
Lobby
Ready System
Race Sync
Kart Collision
Ranking
Server-authoritative Rapier
Snapshot Interpolation
Shared Camera
Reconnect + DNF Cleanup
```

自動驗收已涵蓋 2／3／4 個獨立行動裝置 Browser Context 的進房、選色、滿房提示、Ready、倒數、獨立輸入、多人 3D、權威 DNF 結算、賽後席位清理、Host 重整／斷網重連與手機斷網重連／逾時；伺服器整合另驗證四人三圈同 tick 完賽，以及 6 個四人 Colyseus Room／30 條 WebSocket 的 20 Hz 負載。使用者已確認 Phase 4 真實手機驗收通過，允許進入 Phase 5。

---

## Phase 5

遊戲內容。

加入：

```text
Items
Boost Pad
Jump
Spin Out
Particles
Sound
UI Animation
```

---

## Phase 6

正式遊戲品質。

已核准部署：Vercel Hobby 的 `https://mario-kart.sshnick.com`，Cloudflare 僅調整此子網域；Colyseus 使用 Render Free / Singapore 的平台 HTTPS／WSS 網址，同時最多一房四人。使用者接受冷啟動，不授權付費升級。建房先執行可取消、最多九十秒的 health 輪詢；伺服器重啟會清空記憶體房間，不能承諾免費平台不中斷。

`server/operations.ts` 提供單 process 房間上限、精確允許來源、匿名連線事件及 tick 運算時間統計；health 不快取。`render.yaml` 設一房上限與正式來源，關閉自動部署以避免遊玩中重啟；`vercel.json` 與 GitHub Actions 定義建置／檢查。設定檔不等於已部署或 CI 已執行，操作與 RC 紀錄要求見 `tech-doc/deployment.md`。

渲染設定／診斷／錯誤恢復分離於 `game/rendering/`：省電畫質使用 DPR 1、關閉陰影；`stats=1` 顯示 FPS、p95 frame time、draw calls、三角形及幾何／紋理數。幾何／紋理數不是 GPU 記憶體量測。載入失敗與 WebGL context loss 提供恢復提示，不靜默改變賽事規則。Windows／iPhone 為使用者提供的主要驗收平台；Android 仍在原 roadmap 範圍，尚無真機驗收資料。

加入：

```text
完整賽道
完整 Kart Model
Character
Animation
Music
Sound Effect
Lighting
Post Processing
Performance Optimization
```

---

# 22. MVP 定義

第一個真正可以玩的版本：

```text
1 條賽道

4 台 Kart

最多 4 人

每人獨立 3D 畫面＋鍵盤／手機觸控

Room + QR Code

Acceleration

Steering

Brake

Drift

Collision

Lap

Ranking

Finish Screen
```

暫時不做：

```text
大量角色

大量賽道

複雜道具

完整 Matchmaking

帳號系統

商城

Skin

排行榜
```

---

# 23. 最終目標

最終產品：

> 一款可以直接透過瀏覽器遊玩的 3D Multiplayer Kart Racing Party Game。

玩家只需要一台電腦或手機及瀏覽器，建立或加入房間即可遊玩。各裝置負責自己的 3D 畫面與輸入，WebSocket 將玩家意圖送到共同的權威伺服器，再同步狀態到所有玩家。

核心重點不是模擬真實賽車，而是：

```text
好控制
+
好漂移
+
撞擊有回饋
+
多人互動
+
容易加入
+
遊戲節奏快
```

形成類似 Mario Kart 的 Arcade Kart Racing 體驗。

### 2026-10-01 碰撞手感調整

依使用者要求，一般車輛互撞與護欄碰撞只保留物理推開及依撞擊強度減速，不再強制旋轉、鎖定操控或附送道具免疫；道具命中仍保留受擊旋轉與恢復保護。沒有加入車重差異或新的道具規則。

### 2026-10-02 卡通競速美術調整

依使用者要求提升與卡通派對賽車的視覺接近程度：原創大頭狐狸車手 Pip、加厚圓潤 Pulse 車體與尾翼、草原嘉年華場景（圓樹、風車、花圃、彩旗、熱氣球、遠山及雲）。保留既有環形路線與權威物理，不把場景裝飾當作可駕駛地形；細節及預算見 `art-direction.md`。

### 2026-10-02 核准方向：原創世界、全面提升卡通競速品質

使用者確認保留原創角色與世界，以《瑪利歐賽車世界》的視覺品質與玩法體驗為參考，優先提高賽道可玩性。這取代先前僅調整美術、保留橢圓路線的限制；不授權挪用 Nintendo 素材，也不把品質目標當成已完成的功能清單。

本輪完成原創「風車花谷 / Windmill Valley」：約 240 m 封閉路線、8.4 m 路寬，包含起跑加速直線、湖畔大弧彎、左右交替的風車連續彎與村落回程大彎。以既有三級漂移建立入彎／放出 Turbo 的節奏，較寬路面提供並排及改線空間。三排四個道具箱位於每圈約 8%、40%、72%；三處加速帶位於約 13%、58%、94%，左右偏移 2.4 m，玩家需選線取得加速。沒有新增道具種類或修改道具傷害。

`trackLayout.ts` 保存原創 Bezier 路線、起點與名稱；`trackPath.ts` 以約 1 m 等距重採樣。畫面、路緣、護欄、伺服器碰撞、CPU 循線、Checkpoint、排名及重生使用同一路線。Checkpoint 的 fraction 記錄實際弧長比例，避免標記取樣後與排名上下限不一致。`trackConfig.ts` 保留共享道路尺寸，不再以橢圓半徑與直線長度定義路線。

單人練習和每位連線玩家均有小地圖，顯示路線、終點、加速帶及車輛位置；以 10 Hz 更新 SVG 標記，不觸發 3D 場景重繪。草木與花圃依中心線避讓護欄，彎道牌按曲率配置；湖泊、村落與旋轉風車提供視覺記憶點。場景裝飾不參與權威物理。

本輪仍採平面權威駕駛，不宣稱已完成立體坡道、跳躍／落地技巧、分岔捷徑、滑軌、牆面駕駛、開放世界、大量角色車款或主機級材質／動畫。這些需要各自的物理、路線合法性、鏡頭、同步與效能驗收；整體品質提升方向已獲核准，但尚未實作的內容不能列為完成。

### 2026-10-02 賽事介面修正

同一遊戲頁面內，啟用音效、音量與靜音狀態跨建房／關房保留；切換房間只重設音效事件去重紀錄，不銷毀已由使用者手勢啟用的 AudioContext。離開頁面時仍釋放音效資源，重新載入頁面仍需依瀏覽器規則啟用音效。

房主的 QR Code 面板在倒數／正式開賽時自動收起，重新整理中的賽事也預設收起；仍可手動展開，返回 Lobby 時展開方便管理。房主道具面板改到畫面右上方，鍵盤提示與操作切換獨立放在下方；手機玩家原有右側道具操作維持可用。

### 2026-10-03 多主題賽道與選圖

依使用者要求增加多種原創賽道主題。保留風車花谷，新增霓虹港都（貨櫃、吊車、燈塔與霓虹天際線）、落日砂岩（層狀巨岩、仙人掌、石拱與沙漠聚落）、極光冰谷（水晶冰林、雪峰與極光）。四張各有獨立 Bezier 路線、配色、天空與光線，維持 8.4 m 路寬和三圈規則。冰谷的外觀不改變摩擦力；本輪仍是平面路線，未加入坡道、捷徑或開放世界。

建房前以四張路線卡選圖，同步預覽場景；多人、鍵盤對戰與手機對戰都使用該選擇。賽道固定於房間生命週期，重賽及重新連線保留，換圖須關閉房間後重建。單人練習也可選圖，切換時重設該場練習。

`trackCatalog.ts` 定義主題與路線，`trackData.ts` 為每張賽道產生取樣、道路／護欄、Checkpoint、道具與加速帶位置。核心規則透過參數接收賽道，伺服器每個 SimulationSystem 持有自己的賽道，不切換全域常數，避免不同房間互相影響。客戶端以 TrackContext 同步場景、物理與小地圖。協定版本升為 7；建房的 trackId 由伺服器驗證，控制器不能覆寫，房間狀態與快照回傳權威 trackId。

新增四張賽道的連續性、最小彎曲半徑、護欄無交叉、道具落點及 CPU 三圈驗證，以及多房間地圖隔離、控制器選圖拒絕、瀏覽器選圖／駕駛／重連／手機同步測試。各主題的遠景與裝飾不參與碰撞；可撞擊邊界仍由共用道路資料生成。

### 2026-10-03 核准擴充：立體道路、撞牆反彈與雙道具

使用者要求真正的高低起伏與立體感，取代前輪「平面路線」限制。四張賽道新增不同高度曲線：花谷最高 4.8 m、港都高架 7.5 m、砂岩高架 10 m、冰谷雙峰最高 9 m，另有約 ±4.6° 的平滑傾斜彎道。道路、加厚橋面、支柱、護欄、標記、道具與加速帶依同一份路面資料生成。

Arcade 物理由伺服器的真實三維 Rapier 剛體執行；解除固定 Y 軸，路面約束依目前 XZ 投影取得高度與坡度，設定車體俯仰／側傾及沿坡面的垂直速度。離開道路保留重力與既有重生規則。快照傳送實際 Y，畫面與鏡頭依坡度跟隨，單人練習採相同路面約束。這是連續可行駛坡道，尚未加入空中技巧或分岔捷徑。

路面碰撞延伸至可通行路緣及護欄內緣，採 Rapier `FIX_INTERNAL_EDGES` 消除三角網格接縫卡車；路緣不形成額外小牆。護欄位置與旋轉同時包含高度和坡度。主機碰撞、CPU 循線、Checkpoint 與重生仍由伺服器決定。

撞牆時保留切向速度的 78%，反轉法向速度並保留 48%，側向反彈以 0.3 秒短暫較低抓地力呈現，避免立即被駕駛輸入覆蓋；一般碰撞仍不強制旋轉或鎖定操控，道具攻擊才會鎖定。

背包最多兩件，前格先使用，備用格自動前移，無交換功能。滿格不消耗道具箱；每步最多拾取一箱；拾取及使用均增加 revision，拒絕過期／重複請求。重賽、離線、重生及完賽清除兩格。五種原創 SVG 圖示同時出現在玩家背包與排名摘要；方向鍵說明逐一標示加速、煞車／倒車、左右轉向，保留 WASD，Space 漂移、E 使用前格。

道具回饋新增本人的發動／取得／抵擋／受擊橫幅、加速邊緣速度線及護盾／受擊顏色回饋；3D 尾焰、護盾環、飛盤、光球、拖尾和陷阱辨識度提高。動態物件沿賽道路面高度呈現，不參與權威判定。協定升為 8，前後端必須同步更新。

本輪驗證：`npm run check` 通過 170 項測試，`npm run build` 通過；16 個不同瀏覽器情境分批通過，含單人實際鍵盤三圈、漂移／反彈／重生、四圖切換與重連、手機同步／布局，以及砂岩三圈中真實拾取兩格並按 E 使用。權威模擬另驗證四圖高度軌跡、沿路面貼地、上坡／下坡與三圈完成，以及持續油門撞牆仍反向彈離。這些是本機瀏覽器與模擬驗證，未替代實機跨平台驗收或正式部署。

### 2026-10-03 起跑演出與場景比例

依使用者要求，車身、車手、輪胎與特效統一縮至 72%，保持輪胎接地；水平碰撞範圍同步縮小，鏡頭距離保留以增加大場景感。共用原創螢火蟲飛行裁判與三顆紅燈，3／2／1 依序亮燈，GO 全部轉綠。倒數期間不可移動，轉為 RACING 的唯一一次轉換給予 10 m/s 初速及 1.1 秒二階 Turbo，真人與 CPU 同規則，練習也適用。

四圖的選線加速帶從三處增加至六處（13%、29%、46%、58%、81%、94%），保留左右偏移 2.4 m，增加金色發光及三箭頭。練習也可使用加速帶；本次選擇加速帶玩法，未加入特技跳台／空中技巧。各主題新增花瓣精靈、港口機器人、砂岩角獸、冰晶精靈等原創動態觀眾，位於護欄外，不是碰撞障礙。協定為 9，前後端需一起更新以保持加速帶位置一致。
