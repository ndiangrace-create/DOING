# DOING｜操作路徑樹 CURRENT

更新：2026-08-25（Asia/Taipei）

## 驗收單位

`角色 → CURRENT 入口 → module_key → 操作 → UI 結果 → API → DB → 刷新／重登 → 下一步`

以下路徑只鎖「應保留的操作結果與資料責任」。舊 UI 樣式可重做，Core／DB 結果不可變。

## 一般使用者／報名者｜public-to-registration

路徑：`/ → /market/public/ → /register/ → /me/#activities`

對應模組：`tenant-operations`、`tenant-registration`、`member-center`

完成結果：建立唯一 registrations；審核／付款／退款／報到狀態回到同一筆正式報名。

CURRENT 狀態：`preserve-core-rebuild-ui`

## 品牌使用者｜member-brand

路徑：`/me/#brands`

對應模組：`member-center`

完成結果：品牌與 brand_members 關係正確保存；同名只提示、不自動合併。

CURRENT 狀態：`preserve-core-rebuild-ui`

## 營運申請者｜application-to-workspace

路徑：`/apply/ → LINE OAuth → /me/#operations → /workspace/`

對應模組：`platform-application`、`member-center`、`platform-tenant`

完成結果：符合規則時建立唯一 tenant/workspace；例外進風險處理，不建立第二套工作空間。

CURRENT 狀態：`human-uat-required`

## 租戶擁有者／管理員｜workspace-router

主路徑：`/workspace/ → 選擇工作模組`

工作分支：
- **市集**：`/market/ → /market/session/`
- **活動**：`/market/?work=event → /market/session/`
- **課程**：`/market/?work=course → /market/session/`
- **預約**：`/booking/`
- **專案**：`/project/`

對應模組：`tenant-operations`

完成結果：所有工作模式共用正式 Core／Supabase；路由不同但不得建立第二套資料根。

CURRENT 狀態：`current-router-confirmed`

## 市集／活動／課程主辦｜market-admin

路徑：`/market/ → 場次／待辦／現場／會員／活動／財務／寄賣／設定 → /market/session/`

對應模組：`tenant-operations`、`tenant-registration`、`tenant-finance`、`tenant-people`、`tenant-onsite`、`advanced-seat`、`advanced-performance`、`advanced-consignment`、`advanced-photo`、`tenant-themes`

完成結果：場次 → 審核 → 付款 → 排位 → 通知 → 現場 → 退款／結案使用同一 tenant/session/registration。

CURRENT 狀態：`current-surface-exists`

## 預約營運者｜booking-admin

路徑：`/workspace/ → /booking/`

對應模組：`tenant-operations`、`future-roadmap`

完成結果：預約工作、日曆、服務、資源、每週規則、臨時例外、空檔與到店流程共用正式 booking/operation tables。

CURRENT 狀態：`current-surface-exists`

## 工程／專案營運者｜project-admin

路徑：`/workspace/ → /project/`

對應模組：`tenant-operations`、`project-construction`

完成結果：工程專案資料根已存在，但目前 /project/ 只是入口殼；重建 UI 前不可刪 construction_*。

CURRENT 狀態：`ui-missing-core-data-exists`

## 平台總管｜platform-admin

路徑：`舊 platform.html 已退休 → current compatibility → /workspace/#platform`

對應模組：`platform-access`、`platform-tenant`、`platform-billing`、`platform-products`、`platform-exposure`、`platform-support`、`platform-map`

完成結果：平台 API／DB 能力保留，但 CURRENT 專屬操作面需要重建；不可把舊 platform.html 當新基準。

CURRENT 狀態：`surface-missing-rebuild-required`

## 系統｜governance

路徑：`所有正式操作 → tobeloved-api → DOING_SaaS/public`

對應模組：`core-system`、`tenant-reporting`、`market-app-core`、`platform-map`

完成結果：後端先判權限與 tenant，再寫單一正式 DB；報表只讀正式業務表，不形成第二套主資料。

CURRENT 狀態：`preserve`

## CURRENT 路徑衝突／重建阻擋

- 正式 build 已將 `admin.html` 退休並轉向 `/market/`；Market 現在有真正的 `/market/` 與 `/market/session/` 操作面。
- `platform.html` 已退休並相容導向 `/workspace/#platform`，但目前沒有完整 CURRENT 平台總管操作面；這是重建時必做，不是 DB 缺失。
- `operations-center.html` 已退休並相容導向 `/workspace/#operations`；進階能力與資料仍保留。
- `/project/` 目前是工程專案入口殼，8 張 `construction_*` 資料表已存在，UI 必須重建後才能驗收。
- `/booking/` 已有完整預約中心操作面，應保留其資料／API 契約，但視覺可重新設計。

## 重建順序鎖定

1. 先以 `DOING_MODULE_REGISTRY_CURRENT.json` 決定模組與資料責任。
2. 再依本操作路徑樹重做 CURRENT UI。
3. 每個操作驗證 UI → API → DB → 刷新／重登 → 手機／桌機。
4. 只有完全沒有 CURRENT 路徑、沒有 API 依賴、沒有 DB 責任的舊前端疊層，才可列入刪除候選。
5. 刪除候選必須另做 diff＋回歸後才能真的移除。