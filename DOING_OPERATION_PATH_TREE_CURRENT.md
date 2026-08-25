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

CURRENT 本輪先完成相容操作路徑 `/market/?tenant={tenant}`、`/market/public/?tenant={tenant}`、`/market/session/?tenant={tenant}&sessionId={id}`；漂亮網址 provisioning 仍是獨立 route 工作，不得重建第二套 Market。

## 首頁分類 → 申請

- 市集活動：`/ → /apply/?system=market`
- 室內設計進度：`/ → /apply/?system=project`
- 美類預約：`/ → /apply/?system=booking`

申請頁「系統帳號／網址代號」保存為申請 JSON 的 `tenantSlug`／`requestedTenantSlug`，並顯示對應網址預覽；沿用既有 `tenants.slug`，不新增資料表或第二套 tenant ID。

CURRENT 狀態：`application-ui-preserved`

## 一般使用者／攤商｜market-public-to-registration

CURRENT 路徑：

`/market/public/?tenant={tenant} → 活動列表 → 活動內容 → /register/?tenant={tenant}&session={sessionId} → 報名完成 → 我的紀錄`

「我的紀錄」在 Market 前台同一區域顯示正式審核、付款、位置與現場狀態；會員登入沿用 LINE member token，不進主辦後台。

對應正式 Core／資料：`publicDiscovery`、`getPlatformMemberProfile`、`savePlatformMemberProfile`、`getMyRegsGlobal`、既有 register flow、`registrations`。

完成結果：同一筆 `registrations` 從報名一路承接審核、付款、排位、報到與退款狀態；不得前端建立第二筆影子資料。

CURRENT 狀態：`implemented-e2e-gated`

## 品牌使用者｜member-brand

路徑：`/me/#brands`

對應模組：`member-center`

完成結果：品牌與 brand_members 關係正確保存；同名只提示、不自動合併。

CURRENT 狀態：`preserve-core-rebuild-ui`

## 營運申請者｜application-to-tenant

路徑：`/apply/?system={product} → 填系統帳號／申請資料 → LINE OAuth → /me/ → /workspace/`

資料責任：同一 LINE／DOING member 身分；申請 JSON 保存 requested system 與 requested tenant slug；租戶正式資料仍由既有 tenant／staff／application 流程負責。

完成結果：登入後由正式資料判斷本人、租戶關係及可使用系統；不得由前端 useCases 或 URL 猜權限。

CURRENT 狀態：`preserved-regression-gated`

## 租戶使用者｜market-admin

正式相容入口：`/workspace/?tenant={tenant}&admin_token={token} → /market/?tenant={tenant}&admin_token={token}`。

主辦 Level 1 固定：

`場次｜待辦｜現場｜會員｜活動｜財務｜寄賣｜設定`

操作原則沿用已核准 2BL UX 參考：

`主導航 → 工作區 → 卡片 → 直接操作`

複雜操作最多：`主導航 → 卡片 → 單一 Panel／Modal／單場工作台 → 完成`。

所有主辦 API 必須帶 `tenant + admin_token + JWT email`；後端 staff／tenant 權限為最終裁決。網址或前端顯示不得授權。

CURRENT 狀態：`implemented-e2e-gated`

## DOING Market｜場次總覽

路徑：`/market/?tenant={tenant}&admin_token={token}`。

場次卡直接顯示報名、待審核、錄取、付款、報到、退款摘要；高頻數字直接進同一場的對應工作分頁。

主辦可：新增場次、進名單、進付款、排位／設備、財務、現場；正式資料沿用 `sessions`／`registrations` 與既有 Core。

CURRENT 狀態：`implemented-e2e-gated`

## DOING Market｜待辦

路徑：`/market/ → 待辦`。

正式來源：`getTodos`。待辦卡直接帶入場次與工作類型，點擊後進同一個單場工作台的對應分頁，不另外建立待辦資料根。

CURRENT 狀態：`implemented-e2e-gated`

## DOING Market｜單場工作台

路徑：`/market/session/?tenant={tenant}&admin_token={token}&sessionId={sessionId}`。

固定分頁：

`總覽｜報名審核｜付款｜排位／設備｜通知｜現場｜退款／結案｜場次設定`

正式閉環：

- 報名審核：`updateRegStatus → registrations.review_status → reload`。
- 錄取：後端建立正式付款快照並調整名額；前端不自行計算。
- 付款：`confirmPayment / sendPaymentReminder → registrations/payment records → reload`。
- 排位：`adminSeatBoard / adminAssignSeat / adminUnassignSeat / runBatchAssign → 正式 seat data → reload`。
- 設備：`updateSession.equip → sessions.equip_json`；使用明細 `getSessionEquipmentDetails`。
- 通知：`sendNotify`，付款提醒 `sendPaymentReminder`。
- 現場：`checkin → 正式 checkin state → reload`。
- 退款：`getRefundSuggestion → 二次確認 → confirmRefund → reload`。
- 財務：`financeReport / financeOverview` 讀正式財務資料。
- 場次設定：`updateSession → sessions → reload`。

CURRENT 狀態：`implemented-e2e-gated`

## DOING Market｜會員

路徑：`/market/ → 會員`。

正式來源：`getMembers`；會員／品牌卡不建立第二套 member 表。後續歷史明細沿用 `getMemberHistory`。

CURRENT 狀態：`implemented-base`

## DOING Market｜現場

路徑：`/market/ → 現場 → 選場次 → 搜尋報名 → 報到`，或由單場工作台進 `現場`。

同一功能只接正式 `checkin`；成功後重新讀取正式 registrations／checkin 狀態。

CURRENT 狀態：`implemented-e2e-gated`

## DOING Market｜財務／退款／結案

總覽：`/market/ → 財務`；單場明細：`/market/session/ → 退款／結案`。

正式來源：`financeOverview / financeReport / getRefundSuggestion / confirmRefund`。不得前端自行形成另一套收入、支出、退款或結餘 SSOT。

CURRENT 狀態：`implemented-e2e-gated`

## DOING Market｜設定

路徑：`/market/ → 設定`。

本輪保留品牌設定主入口；場次設定集中於單場工作台。設定一律沿用既有 tenant/session config API，不建立同義設定表。

CURRENT 狀態：`implemented-base`

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

平台能力與資料保留；公開頁不得露出總管入口。

CURRENT 狀態：`preserve`

## 系統｜governance

路徑：`所有正式操作 → tobeloved-api → DOING_SaaS/public`

完成結果：後端先判 member／staff／tenant，再讀寫單一正式 DB；URL slug／tenant query 只定位租戶，不是授權來源。

CURRENT 狀態：`preserve`

## 本輪固定發布 SOP

`Baseline Sync → Module／DB／SSOT Lock → 2BL UX Reference → Role／State／Navigation Contract → CURRENT Implementation → Real-Browser Desktop＋Mobile Click-through → Regression → Fix Until DoD → World Tree／ChangeLog Update → Authorized Merge main → Cloudflare Pages Deploy → Production Verify`

2026-08-25 使用者已明確授權：本輪 DoD 全綠後直接 merge／deploy，不再停在 Release Ready 等第二次確認。
