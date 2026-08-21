# DOING 2.0 ChangeLog

> 規則：只追加，不覆蓋歷史版本。任何新功能、流程優化、頁面重新分類、資料契約調整，都必須先核對 DOING_2.0_WORLD_TREE_V1_BASELINE_20260822.md，再新增紀錄。

## 2026-08-22｜v1 Baseline

- 正式建立 DOING 2.0 定義。
- 舊 DOING 全功能封存為既有能力庫，不刪除、不重做。
- Supabase DOING_SaaS 繼續作唯一正式資料來源。
- 同功能不得新開異名資料表；新增資料表需使用者確認。
- Market 為第一優先產品；主辦操作骨架固定為：場次 → 待辦 → 現場 → 會員 → 設定。
- Market 第一階段收費／繳費沿用 2BL 習慣。
- 現場主要過渡操作：當日名單／該場次全名單 → 搜尋姓名／品牌 → 一鍵報到。
- QR 功能需完整保留與完成，但第一階段不強制夥伴使用。
- Booking 第二優先；Project 後續。

## 2026-08-22｜Market 2.0 操作層開始

- 建立工作分支 `feature/doing-market-2.0-20260822`。
- 開始建立 `market-center.html` 作為 DOING Market 專用營運入口。
- 第一版只重排操作，不修改資料表、不新增正式資料、不破壞既有 admin／onsite／member 功能。

## 2026-08-22｜v2 產品獨立頁與開發排序

- 保留 v1 不修改，新增 `DOING_2.0_WORLD_TREE_V2_PRODUCT_SPLIT_20260822.md`。
- 新增固定產品開發語法 `DOING_2.0_PRODUCT_ROADMAP_FIXED_20260822.md`；既有語法不改。
- 建立 `doing-2.html` 作為 DOING 2.0 Hub。
- `market-center.html` 保持 DOING Market 獨立產品頁，現在主線繼續完成。
- 建立 `project-center.html` 作為 DOING Project 獨立入口；第二主線為室內設計／工程專案，後續接續既有模擬原型，不重做。
- 建立 `booking-2-center.html` 作為 DOING Booking 獨立入口；第三主線為美類／一般服務預約。
- 建立 `guide-center.html` 作為 DOING Guide 獨立入口；第四主線為導覽員／導覽預約。
- 四個產品共用同一 DOING Core／API／Supabase SSOT；獨立頁面不得衍生第二套同功能資料。
- 本次只建立產品頁骨架與固定規則，不新增資料表、不修改正式營運資料、不部署。

## 2026-08-22｜Market 2.0 場次＋現場第一個正式操作閉環

- `market-center.html` 不再只是靜態入口，開始直接讀取正式 `getSessionsAdmin` 場次資料。
- 場次卡直接提供單場工作台、報名名單、付款與現場入口；正式操作仍回既有 `admin.html` 能力，不複製業務資料。
- 現場頁固定依定案流程：選場次 → 當日名單／該場次全名單 → 搜尋姓名／品牌／電話 → 一鍵報到。
- 現場名單直接讀 `getSessionRegistrations`，一鍵報到直接寫既有 `checkin` API，成功後重新讀正式名單，不在前端自建報到狀態。
- QR 能力仍完整保留，但第一階段不強迫夥伴改變現有姓名搜尋習慣。
- 本次沒有新增資料表、沒有修改 2BL、沒有修改 Market App、沒有部署正式環境。

## 2026-08-22｜Market 2.0 單場工作台＋待辦＋會員正式資料接線

- 新增 `market-session.html`，單一市集場次固定為：總覽／報名審核／付款／排位設備／通知／現場／結案。
- 單場工作台直接使用既有 `getSessionDashboard` 與 `getSessionRegistrations` 正式資料。
- 報名審核直接使用既有 `approveReg` 處理錄取、候補、不錄取；操作完成後重新讀取正式報名資料。
- 付款頁直接使用既有 `confirmPayment` 處理攤商已回報的款項；未重做付款資料。
- 現場頁直接使用既有 `checkin` 一鍵報到；完成後重新讀取正式名單。
- Market 主頁的「待辦」改為直接讀取既有 `getTodos`，不在前端自行推算正式待辦。
- Market 主頁的「會員／品牌」改為直接讀取既有 `getMembers`，可搜尋品牌、姓名、手機、Email、FB、IG。
- 排位設備、退款／保證金、完整財務與通知等成熟能力目前先安全連回既有正式後台，後續再逐項內聚，不複製資料。
- 新增 `DOING_2.0_WORLD_TREE_V3_MARKET_EXECUTION_20260822.md` 保存本階段執行狀態；v1、v2 不修改。
- 本階段新增資料表 0、Schema 變更 0、正式資料搬移 0。

## 2026-08-22｜Market 2.0 公開前台獨立入口

- 新增 `market-public.html` 作為 DOING Market 公開入口。
- 公開活動直接讀既有 `publicDiscovery`，不建立第二套活動資料。
- 可依市集／活動／體驗／DIY 分類，搜尋活動名稱、主辦與地點。
- 點活動回到既有正式 `index.html?tenant=...&session=...` 活動詳情與報名流程，不重做報名資料。
- 「我的報名」沿用既有 LINE member OAuth 與 `member-panel.html#activities`。
- localStorage 僅沿用既有 member token 暫存，不保存正式營運資料。
- 新增 `DOING_2.0_WORLD_TREE_V4_MARKET_OPERATIONS_20260822.md` 與 `DOING_2.0_WORLD_TREE_V5_MARKET_PUBLIC_20260822.md`；v1-v3 不修改。
- 本階段新增資料表 0、Schema 變更 0、正式資料搬移 0。

## 2026-08-22｜Market 2.0 Automated Release Candidate

- 建立 `DOING_MARKET_2_RELEASE_CANDIDATE_20260822.md`。
- 最新自動驗證：DOING Market Validation #35 PASS、DOING Safe Production #460 PASS、Cloudflare audit PASS。
- 正式部署仍未執行；deploy skipped。
- 退款流程因涉及管理費、轉場費、活動金防誤退等正式判斷，第一版不簡化重寫，維持成熟既有退款面板。
- 正式 LINE／真實場次／手機與桌機 click-through／付款／QR 真人 UAT 尚未執行，因此狀態固定為 Automated Release Candidate，不宣稱 Release Ready。

## 2026-08-22｜v6 doing.2b-love.com 獨立網址與部署架構

- 使用者定案 `doing.2b-love.com` 作為 DOING 2.0 正式首頁／Hub 網域。
- 產品路徑固定：`/market/`、`/market/public/`、`/market/session/`、`/project/`、`/booking/`、`/guide/`。
- 新增各產品資料夾型路徑入口，保留 query/hash，不重做產品資料。
- 新增 `scripts/build-doing-2-site.mjs`，建立獨立 `.doing-2-site` 部署產物；部署產物根 `index.html` 由 `doing-2.html` 生成，不修改舊 DOING `index.html`。
- 新增 `.github/workflows/doing-2-site.yml`；PR 階段只建置／驗證，push main 才允許建立 Cloudflare Pages `doing-2`、部署並綁定 `doing.2b-love.com`。
- 原先暫建的 Repo 根 `CNAME` 已移除，避免影響既有 GitHub Pages。
- `2b-love.com` 與 2BL 保持完全不動。
- 新增 `DOING_2.0_WORLD_TREE_V6_URL_ARCHITECTURE_20260822.md`；v1-v5 不修改。
- 本階段新增資料表 0、Schema 變更 0、正式資料搬移 0。
