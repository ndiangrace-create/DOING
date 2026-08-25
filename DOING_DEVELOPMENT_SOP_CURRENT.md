# DOING｜Development SOP CURRENT

狀態：CURRENT／最高優先
更新：2026-08-25 Asia/Taipei

本文件是 DOING 開發、操作路徑設計、驗收與發布前流程的唯一 SOP SSOT。其他文件只可引用，不得複製出第二套流程。

## 固定流程

`Baseline Sync`
→ `Module／DB／SSOT Lock`
→ `Multi-perspective`
→ `依賴關係盤點`
→ `Role × State Matrix`
→ `Task Flow`
→ `Navigation Contract`
→ `Click-through Prototype`
→ `Reverse Brainstorming`
→ `Decision Gate`
→ `正式實作`
→ `Real-Browser E2E`
→ `Regression`
→ `Fix Until DoD`
→ `World Tree／ChangeLog 更新`
→ `Release Ready`

## 各階段固定契約

### 1. Baseline Sync
先讀最新 main、CURRENT SSOT、最後成功 checkpoint、正式部署狀態與既有資料；禁止從舊版猜測。

### 2. Module／DB／SSOT Lock
既有模組、資料表、API、handler、正式網址、資料來源、命名與租戶隔離全部鎖定。不得重新設計、重複建表、改名、另建同義資料根或改變 SSOT。正式營運資料唯一來源仍是 Supabase DOING_SaaS/public。

### 3. Multi-perspective
至少從一般會員／申請者、租戶 Owner、租戶 Admin、Staff／現場、平台管理者與系統安全角度檢查同一流程；不得只站工程角度。

### 4. 依賴關係盤點
每一條流程先盤點登入身分、tenant、角色、狀態、既有 API、資料表、前後頁、回跳、錯誤處理與外部依賴，禁止未盤點就修改。

### 5. Role × State Matrix
明確列出「角色 × 資料狀態 × 可見內容 × 可操作範圍 × 成功／失敗結果」。角色與狀態不得由前端猜測；後端正式資料為最終裁決。

### 6. Task Flow
以使用者任務為單位整理從入口到完成的完整主路徑與異常分支，不以單一頁面或單顆按鈕為完成單位。

### 7. Navigation Contract
每個正式按鈕必須至少定義：
- 顯示條件
- 按鈕名稱
- 所在位置
- 點擊動作
- 使用資料
- API
- 成功結果
- 失敗結果
- 下一步
- 返回位置

沒有完整 Navigation Contract 的按鈕不得進正式實作。

### 8. Click-through Prototype
先做手機與電腦版可實際點擊 Prototype，覆蓋主要流程與異常分支。Prototype 階段不得新增正式資料表、不得改既有資料來源、不得寫入正式營運資料。

### 9. Reverse Brainstorming
主動反向尋找並封堵：迷路、斷路、重複操作、回不去、錯 tenant、錯角色、錯狀態、未申請功能被顯示、已申請功能進不去、登入回跳錯誤、member/admin token 混用、成功後沒有下一步等問題。

### 10. Decision Gate
新流程／改路徑必須停在 Decision Gate 給使用者確認。未通過 Decision Gate 不得串正式功能、不得修改正式資料與權限邏輯、不得部署。

### 11. 正式實作
只實作 Decision Gate 已確認內容；只修 delta，不重做已通過項目。既有模組、DB、API 與正式路徑繼續沿用。

### 12. Real-Browser E2E
不得只檢查 DOM 或按鈕存在。必須實際登入並逐一點擊，確認頁面、角色／tenant 權限、API、DB 讀寫、狀態變更、下一步與返回路徑全部正確；手機與電腦版都要驗證。

### 13. Regression
確認本次變更沒有破壞已通過功能、跨角色隔離、既有網址、API、資料庫與 2BL 邊界。

### 14. Fix Until DoD
發現問題立即修正並從最近失敗 checkpoint 重驗；禁止為了單一錯誤全面重跑或重做已通過項目。直到 DoD 全部通過才可往下。

### 15. World Tree／ChangeLog 更新
只更新現有 CURRENT 世界樹與 ChangeLog；不另開第二套世界樹、不建立重複治理資料。

### 16. Release Ready
完成所有自動驗證、Real-Browser E2E、Regression、DoD、世界樹與 ChangeLog 後停在 Release Ready。正式部署需要使用者明確說「部署／發布」。

## Atomic Checkpoint＋Audit Trail

Atomic Checkpoint 與 Audit Trail 貫穿全部階段，不是額外獨立步驟：
- 每階段留下「輸入基準／變更範圍／結果／證據／下一 checkpoint」。
- 已 PASS 項目不得因後續失敗而重做。
- 失敗只回到最近失敗點修正。
- GitHub PR／commit／ChangeLog 保存詳細歷史；Supabase 不保存逐步聊天或重複 checkpoint。

## 紀錄政策

Supabase 只允許一筆 `doing_development_sop_current` CURRENT 設定，日後以覆寫更新方式維護，不新增歷史版本、不新增 SOP 專用資料表。詳細歷史留在 GitHub ChangeLog／PR／commit。

## 安全邊界

- 2BL 與 DOING 永久隔離，禁止修改 `2bl-v7` 或 2BL Worker／Routes／Secrets／Supabase／GitHub／網域。
- `worker.js` 與 `worker.txt` 必須保持一致。
- 不得自行新增正式網址；任何 route 先對照 `DOING_UI_ROUTE_SSOT_CURRENT.json` 與 `DOING_OPERATION_PATH_TREE_CURRENT.md`。
- 不得自行修改計費規則。
- 使用者未說「執行」前不得動工；新路徑／新操作的「執行」先做到 Decision Gate，確認後才正式實作。
