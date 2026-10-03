# Phase 6 部署與 RC 操作手冊

## 已核准的部署範圍

- 網站：`https://mario-kart.sshnick.com`，Vercel Hobby；DNS 管理商 Cloudflare。
- 權威遊戲伺服器：Render Free / Singapore，一個 Node.js process，同時最多一房（Host＋最多四位 Controller）；CPU 不占 WebSocket 席位。
- Render 沿用平台 HTTPS 網址，SDK 以 WSS 連線；不新增後端自訂網域、不變更 `sshnick.com` 主站。
- 使用者接受免費主機冷啟動；不購買主機、不自動升級、不增加 Redis／資料庫／帳號系統。
- 此方案是朋友試玩部署，不能承諾免費平台的 production SLA。正式上線、Windows／iPhone 四人與效能門檻仍須實際驗收，不因接受冷啟動而自動通過。

## 本機與 CI

`npm ci` → `npm run check` → `npm run build` → `npm run test:e2e`。
CI 定義於 `.github/workflows/ci.yml`，使用 Node 22、Chromium、現有完整 E2E，失敗保留七天 trace／截圖。工作流程寫入不代表 GitHub 已執行；需要 repository 中實際綠燈紀錄。

正式模型由 `scripts/build-models.py` 生成，Blender 4.5 LTS：

```sh
blender --background --factory-startup --python scripts/build-models.py
```

`.blend` 與未壓縮參照 GLB 置於 `art-source/`，正式 Draco GLB 置於 `public/models/`。Vitest 解析參照 GLB 並檢查正式檔頭／壓縮標記／體積、三角形、輪胎半徑和動畫；瀏覽器驗證正式壓縮檔能以本地 WASM 真正解碼。沒有外部紋理／字型依賴，Blender 不需安裝於 production 主機。

車身 GLB 約 144 KiB → 33 KiB、輪胎約 28 KiB → 6.7 KiB；本地 Draco WASM＋wrapper 約 245 KiB，另備非 WASM decoder。壓縮節省模型檔，但初次載入還有 decoder 成本，不宣稱首次總下載必然變小；須在正式網址實測快取與壓縮後的傳輸量。

## 部署步驟（尚未執行）

1. 由使用者授權 GitHub repository、Render 及 Vercel；不在程式或聊天中放密碼、token。
2. Render 匯入 `render.yaml`，確認 Free、Singapore、單一 instance。`autoDeployTrigger: off` 避免遊玩中因 push 自動重啟。建置包含 devDependencies，因目前以 `tsx` 執行 TypeScript server。
3. 確認環境變數：`MAX_ROOMS=1`、`ALLOWED_ORIGINS=https://mario-kart.sshnick.com`。`PORT` 由 Render 配發，server 綁定 `0.0.0.0`。未設定 ALLOWED_ORIGINS 時 production 拒絕帶 Origin 的瀏覽器請求。
4. 開啟 Render 給定的 `https://實際服務名稱.onrender.com/health`；須返回 `ok: true`、`roomType: race`。記錄真實後端 URL，不能使用虛構範例值。
5. Vercel 匯入 Next.js 專案，選 Hobby，build 前加入 `NEXT_PUBLIC_COLYSEUS_URL=https://實際服務名稱.onrender.com`。這是公開端點，不是秘密；變更後需重新 build。
6. Vercel 加入 `mario-kart.sshnick.com`，Cloudflare 僅新增／調整名稱為 `mario-kart` 的 DNS，值以 Vercel 當下提供為準；先用 DNS only 驗證憑證。勿覆寫 apex、MX、其他子網域或變更 nameserver。
7. 確認正式 HTTPS 憑證、手機 QR 指向正式網域、WebSocket 是 WSS。預覽網址預設不加入允許來源；若需驗收特定 preview，明確新增該精確 origin，勿放寬為 wildcard。
8. 僅在 CI 通過且無進行中房間時手動部署前後端。互不相容的協定升級需同時更新；目前協定版本仍為 4。

## 冷啟動與故障

Host 建房前對 `/health` 執行唯讀輪詢，每次最多八秒，間隔兩秒，整體最多九十秒；UI 可取消，逾時可重新建房。只重試 health，不自動重試 create，以避免回應丟失時建立重複房間。手機由成功建房的 QR 加入，不需要另外先建立房間。

Render 免費服務閒置十五分鐘休眠、冷啟動約一分鐘；可能隨時重啟。記憶體房間無持久化，process 重啟不能由八秒短暫重連復原，應重新建房。不得以持續自動 ping 規避休眠。用量不足或不支援所需效能時，停止並向使用者提出方案，不靜默升級。

## 監控與資料

- `/health`：process 健康、目前房間數、累積 tick 樣本／平均／最大運算時間（不是精準 tick 間隔或 GPU 量測）。Render health check 使用此路徑。
- production JSON stdout：房間開關及加入／離開事件；不寫暱稱、重連 token、input 原文或 IP。平台本身可能保留存取與連線資訊，公開說明須揭露。
- Host 在網址加 `stats=1` 顯示一秒窗口 FPS、p95 frame time、draw calls、三角形及 WebGL 幾何／紋理物件數。這些數字不是 GPU 記憶體 bytes；需另外用 Windows 瀏覽器／系統工具量測 GPU 與記憶體。
- 畫質選單可切換標準與省電（DPR 1、無陰影）；只改渲染，不改 60 Hz 權威物理或 20 Hz 同步。
- 暱稱只用於房內顯示；瀏覽器 sessionStorage 保存短期重連資訊。沒有帳號、分析追蹤、持久化排行榜或支付。
- 房間數限制是單 process，同部署不得加第二個 instance 來規避容量限制；來源檢查不是身分驗證，非瀏覽器仍可偽造來源。朋友用連結／QR 邀請，不保證私人房間的密碼保護。

## RC 紀錄表（尚待實測）

每場填寫：日期／版本 commit、Windows 型號 CPU GPU RAM、Chrome／Edge 版本、iPhone 型號／iOS／Safari、網路、畫質、解析度、初載時間、FPS／p95、draw calls、GPU／記憶體、RTT、server tick、發熱／耗電、異常步驟。

必測：正式網址四人多場三圈、道具、碰撞、重生、結算、重賽；iPhone 橫直向、安全區、拒絕感測器與觸控備援；Host 重整、網路中斷、音效授權、WebGL context loss；第二房拒絕及首房關閉後可重建。尚未提供 Android 實機，原 roadmap 的 Android 驗收不能由 iPhone 代替。

## 平台參考

- [Render Free 限制](https://render.com/docs/free)
- [Render Blueprint 格式](https://render.com/docs/blueprint-spec)
- [Vercel Hobby](https://vercel.com/docs/plans/hobby)
- [Vercel 自訂網域](https://vercel.com/docs/domains/working-with-domains/add-a-domain)
