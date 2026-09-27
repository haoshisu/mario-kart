# Web 3D 多人卡丁車遊戲

## 企劃暨技術設計文件

> 實作狀態（2026-09-27）：Phase 1、2 已完成。Phase 3 的程式、單元／伺服器整合測試、production build，以及 Chromium 雙 Browser Context 的 3D／物理／網路驗收均已完成；iOS、Android 真實裝置的最終人工驗收仍待執行。Phase 4 以後尚未實作。

## 1. 專案目標

打造一款類似 Mario Kart 遊玩體驗的 Web 3D 多人卡丁車遊戲。

主要特色：

- 網頁直接遊玩，不需安裝 App
- 3D 卡丁車、3D 賽道與完整場景
- Arcade 風格駕駛手感
- 漂移、碰撞、加速、道具
- 電腦或電視作為主要遊戲畫面
- 玩家使用手機作為控制器
- 支援多人 Room
- QR Code 快速加入
- 未來可支援多人網路對戰

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
玩家手機掃描 QR Code
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

Host 裝置：

```text
PC / Mac / TV
┌──────────────────────────────┐
│                              │
│         3D Racing Game       │
│                              │
│     🚗          🏎️          │
│                              │
│     🚙          🚕           │
│                              │
│ Lap 2/3        Position 1st  │
└──────────────────────────────┘
```

玩家手機：

```text
┌───────────────────┐
│      Nick         │
│                   │
│   ◀           ▶   │
│                   │
│ DRIFT       ITEM  │
│                   │
│       GAS         │
└───────────────────┘
```

未來可加入手機陀螺儀：

```text
手機左傾 → 左轉

手機右傾 → 右轉
```

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
手機 Controller
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
Host Game
```

Phase 3 的 Colyseus 服務以獨立常駐 Node.js process 執行，不放在 Next.js Serverless Route。伺服器只建立房間、驗證及轉送單一控制器輸入；Rapier 與賽事狀態仍由 Host 持有。伺服器權威模擬、多人狀態快照與插值保留到 Phase 4。

---

# 12. Room System

Phase 3 Room：

```text
9 位隨機 Colyseus Room ID
```

資料：

```ts
Room {
  roomId
  hostConnection
  controllerConnection
  controllerNickname
}
```

Player：

```ts
Player {
  sessionId
  role: "host" | "controller"
  nickname
}
```

每個房間只允許一個 Host 與一個 Controller。Host 可主動關房；Host 離開或重連逾時時房間釋放。Controller 斷線後保留 8 秒重連窗口，並立即將 Host 輸入歸零。

---

# 13. 手機 Controller

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

觸控輸入以 20 Hz 傳送，封包帶有遞增序號與手機送出時間；伺服器會驗證角色、數值範圍、順序與傳送頻率。Host 的 Rapier step 套用輸入後送回 acknowledgement，手機計算完整控制回饋 RTT，再回報 Host 顯示。250 ms 未收到非中立輸入更新時，伺服器會要求 Host 歸零。

---

# 14. Network Synchronization

多人遊戲需要處理：

```text
Latency
Packet Delay
Jitter
Position Sync
```

可逐步加入：

```text
Interpolation
Prediction
Reconciliation
```

第一版先做：

```text
Input Sync
+
State Sync
```

即可。

---

# 15. Camera System

## MVP

使用單一 Camera。

Camera 自動追蹤所有玩家。

```text
🚗

      🚙

🏎️

      🚕
```

Camera 自動調整：

```text
Position
Zoom
Angle
```

確保所有玩家都在畫面中。

---

## Future

Split Screen：

```text
┌────────┬────────┐
│   P1   │   P2   │
├────────┼────────┤
│   P3   │   P4   │
└────────┴────────┘
```

每位玩家：

```text
Independent Camera
```

---

# 16. Item System

未來加入道具。

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

目前 3D 場景以 React memo 隔離 HUD 的 10 Hz 遙測更新，避免速度與賽事顯示更新時重跑場景元件。Canvas 的裝置像素比上限為 1.5，以降低高解析度螢幕的繪製負擔；車體的顯示層以 Rapier 插值後的位置為目標，使用保留速度的臨界阻尼平滑水平位置。鏡頭與車體共用這個顯示位置，不再額外平滑水平追蹤，避免加減速時出現相對前後擺動；鏡頭高度與轉向仍使用阻尼。物理、碰撞與賽事判定維持原本固定步進，車體顯示高度直接遵循貼地結果。重生與長時間切離頁面後重設顯示層與鏡頭的跟隨速度。

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
│   └── RaceMarkers.tsx
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

Phase 3 已建立的獨立 Server：

```text
server/
├── createGameServer.ts
├── index.ts
└── rooms/
    └── RaceRoom.ts
```

多人 state schema、權威 Simulation／Race／Collision systems 屬 Phase 4，本階段沒有預先建立。

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

手機控制器與單一配對房間：程式及自動驗收完成，真實 iOS／Android 裝置人工驗收待執行。

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

多人（尚未開始）。

預計：

```text
2～4 Players
Lobby
Ready System
Race Sync
Kart Collision
Ranking
```

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

手機 Controller

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

玩家只需要：

```text
電腦 / TV
+
手機
```

即可遊玩。

主畫面負責：

```text
3D Game
```

手機負責：

```text
Controller
```

透過：

```text
WebSocket
+
Realtime Multiplayer Architecture
```

連接所有玩家。

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
