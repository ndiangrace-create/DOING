# DOING｜操作路徑樹 CURRENT

更新：2026-08-25（Asia/Taipei）

## 驗收單位

`角色 → CURRENT 入口 → 租戶上下文 → 操作 → UI 結果 → API → DB → 刷新／重登 → 下一步／返回`

以下只鎖操作路徑與資料責任。既有 Module／DB／SSOT 已定案，不因 UI／Navigation 重建而另建同義資料表、API 或資料來源。

## 租戶網址層級｜Decision Gate 已定案

正式方向固定為：`產品前綴 / tenant slug / 後續工作內容`。

- Market：`/market/{tenant-slug}/`
- Project：`/project/{tenant-slug}/`
- Booking：`/booking/{tenant-slug}/`

`tenant-slug` 沿用既有 `tenants.slug`，不得建立第二套公開 ID 欄位。LINE／會員 ID 不放在網址；網址只負責產品與租戶上下文，管理權限仍由正式 member／staff／admin session 驗證，手動輸入網址不得取得權限。

目前正式站尚未發布上述動態路由；本段為下一階段 Market Click-through Prototype 與 Navigation Contract 的唯一方向，不得自行另開 `/market-dashboard/`、`/tenant-home/` 等路徑。

## 首頁分類 → 申請

- 市集活動：`/ → /apply/?system=market`
- 室內設計進度：`/ → /apply/?system=project`
- 美類預約：`/ → /apply/?system=booking`

申請頁新增「系統帳號／網址代號」，保存為申請 JSON 的 `tenantSlug`／`requestedTenantSlug`，並顯示對應網址預覽。這只是沿用既有 `tenants.slug` 的申請資料，不新增資料表或第二套 tenant ID。

CURRENT 狀態：`application-ui-ready-route-binding-next-stage`

## 一般使用者／報名者｜public-to-registration

Market 下一階段目標路徑：`/market/{tenant-slug}/ → 活動／場次 → /register/ → /me/#activities`

對應模組：`tenant-operations`、`tenant-registration`、`member-center`

完成結果：建立唯一 registrations；審核／付款／退款／報到狀態回到同一筆正式報名。

CURRENT 狀態：`market-clickthrough-next`

## 品牌使用者｜member-brand

路徑：`/me/#brands`

對應模組：`member-center`

完成結果：品牌與 brand_members 關係正確保存；同名只提示、不自動合併。

CURRENT 狀態：`preserve-core-rebuild-ui`

## 營運申請者｜application-to-tenant

路徑：`/apply/?system={product} → 填系統帳號／申請資料 → LINE OAuth → /me/`

資料責任：同一 LINE／DOING member 身分；申請 JSON 保存 requested system 與 requested tenant slug；租戶正式資料仍由既有 tenant／staff／application 流程負責。

完成結果：登入後必須由正式資料判斷本人、租戶關係及可使用系統；不得由前端 useCases 或 URL 猜權限。

CURRENT 狀態：`human-uat-required`

## 租戶使用者｜product-tenant-entry

固定模型：`產品 → tenant slug → 會員／staff 權限`。

- Market：`/market/{tenant-slug}/`
- Project：`/project/{tenant-slug}/`
- Booking：`/booking/{tenant-slug}/`

同一 tenant 可使用多個已開通產品；同一 member 可與多個 tenant 有正式關係。沒有權限的產品不顯示，不以「尚未確認權限」卡片占位。

CURRENT 狀態：`navigation-contract-approved-prototype-pending`

## DOING Market｜公開首頁＋隱藏租戶入口

`/market/{tenant-slug}/` 定位為該租戶對外公開的市集／活動首頁，給攤商、參加者與一般民眾使用。

租戶 Owner／Staff 使用同一公開頁的隱藏入口發起身分確認；隱藏手勢本身不授權。正式權限確認成功後才切入該 tenant 的操作模式。

下一階段互動基準沿用 2BL：

`主導航 → 工作區 → 卡片 → 直接操作`

複雜操作最多：`主導航 → 卡片 → 單一 Panel／Modal → 完成`

租戶操作 Level 1 固定參考：`場次｜待辦｜現場｜會員｜活動｜財務｜寄賣｜設定`。

單場工作延續至 `/market/{tenant-slug}/session/{session-context}` 的概念，但實際 route shape 必須先在 Click-through Prototype／Navigation Contract 決定，Decision Gate 前不得自行實作新 route。

CURRENT 狀態：`decision-gate-approved-prototype-next`

## 預約營運者｜booking-admin

目標租戶入口：`/booking/{tenant-slug}/`

對應模組：既有 booking／operation 資料根與正式 Core。

完成結果：預約工作、日曆、服務、資源、每週規則、臨時例外、空檔與到店流程不得重建第二套資料。

CURRENT 狀態：`route-pattern-approved-ui-later`

## 工程／專案營運者｜project-admin

目標租戶入口：`/project/{tenant-slug}/`

對應模組：既有 project／construction 資料根。

完成結果：工程專案資料根保留，UI／Navigation 重建不得刪除或複製 construction_*。

CURRENT 狀態：`route-pattern-approved-ui-later`

## 平台總管｜platform-admin

平台能力與資料保留；CURRENT 專屬操作面後續依 Role × State Matrix 重建。公開頁不得露出總管入口。

CURRENT 狀態：`surface-missing-rebuild-required`

## 系統｜governance

路徑：`所有正式操作 → tobeloved-api → DOING_SaaS/public`

完成結果：後端先判 member／staff／tenant，再讀寫單一正式 DB；URL slug 只定位租戶，不是授權來源。

CURRENT 狀態：`preserve`

## 下一階段固定 SOP

`Baseline Sync → Module／DB／SSOT Lock → Multi-perspective → 依賴關係盤點 → Role × State Matrix → Task Flow → Navigation Contract → Click-through Prototype → Reverse Brainstorming → Decision Gate → 正式實作 → Real-Browser E2E → Regression → Fix Until DoD → World Tree／ChangeLog 更新 → Release Ready`

Market 下一個新對話從 Role × State Matrix／Task Flow 開始，參考 `2BL_INTERACTION_FRAMEWORK_PACKAGE` 的少層級、卡片直接操作方式；只參考 UX／流程，禁止修改 2BL 或使用 2BL 資料來源。
