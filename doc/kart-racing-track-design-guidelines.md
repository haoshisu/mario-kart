# Kart Racing Track Design Guidelines

重新檢視並改善遊戲中所有賽道的 Level Design。

設計方向參考 Mario Kart 類型的 arcade kart racing level design philosophy，但不要直接複製任何既有 Mario Kart 賽道、路線、場景或資產。

## 核心目標

不要把賽道設計成「道路 + 大量裝飾物」。

每張地圖都必須是一段具有節奏、變化、驚喜與互動性的駕駛體驗。

玩家跑完整圈後，應該能清楚記得這張地圖特有的 2～3 個場景或玩法，而不是只記得地圖的顏色或 Theme。

## 1. Gameplay Sections

每張賽道拆成約 6～10 個具有明顯差異的 Gameplay Sections。

例如：

Start → High Speed → Technical Corners → Environmental Transition → Gameplay Gimmick → Spectacle Moment → Risk / Reward → Final High Speed → Finish

不要讓玩家長時間只是沿著道路轉彎。

相鄰 Section 必須至少在其中一項產生明顯變化：

* Driving rhythm
* Track width
* Elevation
* Environment
* Visibility
* Obstacles
* Route choice
* Speed
* Gameplay mechanic

## 2. Gameplay Rhythm

避免：

Straight → Corner → Straight → Corner → Straight → Corner

優先設計：

High Speed → Technical → Exploration → Spectacle → Decision → High Speed → Technical → Finale

整圈必須存在快慢節奏。不要讓所有區域的駕駛感受相同。

## 3. Event Density

目標讓玩家平均每 5～10 秒遇到一次新的：

* Gameplay event
* Environmental event
* Route decision
* Obstacle
* Elevation change
* Landmark
* Spectacle moment

不代表每 5 秒都需要障礙物。

可以是：進入洞穴、跳躍、道路突然下降、巨大物體經過、環境改變、道路分岔、看到巨大 Landmark 等。

## 4. Verticality

避免整張地圖接近平面。

合理使用：

* Uphill
* Downhill
* Bridges
* Tunnels
* Cliffs
* Jumps
* Banking
* Multi-level roads
* Roads crossing above/below each other

高低差本身也應該影響駕駛體驗，而不只是視覺裝飾。

## 5. Spectacle Moments

每張地圖至少設計 1～3 個讓玩家第一次看到會產生「Wow」感的瞬間。

例如：

* Large jump
* Huge drop
* Environment transformation
* Massive moving object
* Entering/leaving a major structure
* Dramatic reveal
* Large-scale environmental event

Spectacle 必須與玩家駕駛路線產生關係。不要只是把大型模型放在遠處。

## 6. Gameplay Gimmick

每張地圖至少要有一個與 Theme 高度相關的獨特 Gameplay Mechanic。

例如：

* Forest: falling trees / wooden bridges
* Snow: slippery ice / rolling snowballs
* Volcano: lava eruption / falling rocks
* Factory: moving machinery / conveyor belts
* City: traffic / intersections
* Harbor: moving containers / ships

不同 Theme 不應只是換 Texture 和模型。Theme 必須影響 Gameplay。

## 7. Risk / Reward

每張地圖至少設計一個 Risk / Reward。

例如：

Safe Route → 比較寬 → 比較容易 → 比較慢

Risk Route → 比較窄 → 有障礙 → 需要 Jump / Drift / Boost → 成功可以節省時間

讓高手與新手可以做不同選擇。

## 8. Shortcuts

Shortcut 不應只是單純縮短道路。

Shortcut 最好需要：

* Boost
* Good drift
* Precise jump
* Item
* Timing
* Mechanical skill

並且具有失敗成本。

## 9. Track Scale

避免：「小車行駛在巨大空道路上」。

控制：

* Track width
* Prop distance
* Guardrail scale
* Environment distance
* Landmark scale

讓環境適度靠近玩家。

道路可以根據 Gameplay Section 有 Wide → Narrow → Wide 的變化。

## 10. Environmental Layers

場景至少考慮三個層次：

### Trackside

直接影響速度感：

* Barriers
* Signs
* Rocks
* Vegetation
* Buildings
* Lights
* Spectators

### Midground

建立場景：

* Forest
* Structures
* Cliffs
* Waterfalls
* Industrial machinery
* Villages

### Background

建立世界尺度：

* Mountains
* Cities
* Volcanoes
* Castles
* Giant structures
* Sky elements

不要把所有環境物件均勻散布。應該有視覺密度與留白的節奏。

## 11. Landmarks

每張地圖建立 2～4 個主要 Landmark。

Landmark 最好可以從不同賽道區域看到。

讓玩家：看到 Landmark → 接近 Landmark → 經過 / 穿越 Landmark → 從另一個方向再次看到

利用 Landmark 建立方向感與期待感。

## 12. Environmental Motion

不要讓世界完全靜止。

根據 Theme 適量加入：

* Particles
* Flags
* Vegetation movement
* Water
* Smoke
* Fire
* NPC activity
* Moving machinery
* Background vehicles
* Wildlife
* Weather effects

Motion 的目的不是單純增加特效，而是讓世界感覺正在運作。

## 13. Track Readability

華麗不能犧牲可讀性。

玩家高速行駛時仍然必須快速理解：

* Road direction
* Upcoming corner
* Jump direction
* Dangerous area
* Shortcut
* Obstacle
* Track boundary

使用：

* Lighting
* Road markings
* Arrow signs
* Color contrast
* Props
* Environment composition

自然引導玩家視線。不要只依賴 UI 箭頭。

## 14. Camera & Speed Feedback

Level Design 必須配合 Camera 與車輛 Feedback。

高速區：

* Slight FOV increase
* Environment passes closer to player
* Speed particles

Boost：

* FOV impulse
* Speed streak
* Vehicle effect
* Camera impulse

Jump：

* Clear anticipation
* Air-time presentation
* Landing feedback

Drift：

* Vehicle lean
* Tire smoke
* Sparks
* Camera response

讓道路速度與玩家「感受到的速度」一致。

## Minimum Requirements

每張完整賽道至少包含：

* 6～10 個 Gameplay Sections
* 2 個以上明顯 Elevation Changes
* 1 個 Major Spectacle Moment
* 1 個 Theme-specific Gameplay Gimmick
* 1 個 Risk / Reward Section
* 1 個 Shortcut
* 2～4 個 Major Landmarks
* 至少一段 High-speed Section
* 至少一段 Technical Section
* Environmental Motion
* Clear visual guidance

這些不是要求每張地圖使用完全相同的 Layout。每張地圖仍然必須根據 Theme 產生自己的特色。

## Important Design Principle

不要透過單純增加模型數量讓地圖看起來豐富。

優先順序應為：

Gameplay → Track Rhythm → Route Variation → Verticality → Spectacle → Landmark → Environmental Storytelling → Decoration

如果一個物件：

* 不影響 Gameplay
* 不幫助 Navigation
* 不建立 Landmark
* 不增加速度感
* 不強化 Theme

則不要只是為了「看起來比較豐富」大量加入。

最終目標：玩家不是在一條漂亮的道路上開車，而是在一個會不斷發生事情的遊樂園式世界中競速。
