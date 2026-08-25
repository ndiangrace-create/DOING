# DOING｜操作路徑樹 CURRENT

更新：2026-08-25（Asia/Taipei）

## 驗收單位

`角色 → CURRENT 入口 → 系統權限 → 操作 → UI 結果 → API → DB → 刷新／重登 → 下一步`

以下路徑只鎖「應保留的操作結果與資料責任」。舊 UI 樣式可重做，Core／DB 結果不可變。

## CURRENT 身分／租戶／系統模型（最高優先）

正式模型：`一個 DOING／LINE 會員 → 一個自有 tenant/workspace → 可開通多個工作系統`。

- 會員身分：`platform_members`＋`platform_member_identities`。
- 自有營運帳號：`tenants`＋`staff.platform_member_id`。
- 已開通系統唯一判斷：`tenant_settings.module_flags_json.workModules`。
- `workModules` 目前公開 key：`market`、`project`、`booking`。
- 同租戶共用會員／顧客／團隊等共用資料；各系統工作資料仍依正式工作資料表與類型分類。
- 未開通的系統不可在 `/me/` 或 `/workspace/` 顯示成可選項，也不可用舊 `useCases` 猜測權限。
- 新申請另一套系統時，只增加原 tenant 的 system entitlement；不得重建會員、不得重建第二個自有 tenant。

## 首頁三個公開分類｜home-system-classification

固定入口與路徑：

- **市集活動系統**：`/ → /apply/?system=market → LINE → /market/`
- **室內設計進度系統**：`/ → /apply/?system=project → LINE → /project/`
- **美類預約系統**：`/ → /apply/?system=booking → LINE → /booking/`

三種申請共用同一份基本申請資料；`requestedSystem` 決定本次只開通哪一套。

CURRENT 狀態：`entitlement-router-release-candidate`

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

## 營運申請者｜application-to-system

路徑：`/apply/?system=<market|project|booking> → LINE OAuth → 會員身分解析 → 自有 tenant 解析 → 加開 system entitlement → 對應系統首頁`

對應模組：`platform-application`、`member-center`、`platform-tenant`、`tenant-operations`

完成結果：

1. 沒有自有 tenant：建立第一個且唯一的自有 tenant，並只開通本次系統。
2. 已有自有 tenant：沿用同一 tenant，只增加本次系統權限。
3. 同一系統已開通：不得重複申請。
4. 多自有 tenant 等例外情境：fail closed，轉人工確認，不自行猜目標 tenant。

CURRENT 狀態：`release-candidate-human-line-uat`

## LINE 登入｜member-login-system-resolution

路徑：`/me/ → LINE OAuth → getPlatformMemberProfile → createMemberWorkspaceAdminSession → getTenantModuleProfile → workModules → 系統入口`

判斷規則：

- 只有 1 個已開通系統：登入成功直接進該系統。
- 有 2 個以上：`/me/` 只列出真正已開通的系統供選擇。
- 未開通系統：完全不顯示。
- `applications.useCases`、`moduleProfile.useCases`、畫面文案不得作為登入權限依據。
- LINE token 只解析會員本人；系統權限仍由正式 tenant entitlement 決定。

CURRENT 狀態：`release-candidate-human-line-uat`

## 租戶擁有者／管理員｜workspace-router

主路徑：`/workspace/ → 只顯示 workModules=true 的系統`

工作分支：
- **市集**：`/market/ → /market/session/`
- **預約／美類**：`/booking/`
- **工程／專案**：`/project/`

對應模組：`tenant-operations`

完成結果：同一 tenant 可有多套系統，但 UI 不顯示未開通系統；不同系統共用正式 Core／Supabase，不建立第二套資料根。

CURRENT 狀態：`entitlement-router-release-candidate`

## 市集主辦｜market-admin

路徑：`/market/ → 場次／待辦／現場／會員／活動／財務／寄賣／設定 → /market/session/`

對應模組：`tenant-operations`、`tenant-registration`、`tenant-finance`、`tenant-people`、`tenant-onsite`、`advanced-seat`、`advanced-performance`、`advanced-consignment`、`advanced-photo`、`tenant-themes`

完成結果：場次 → 審核 → 付款 → 排位 → 通知 → 現場 → 退款／結案使用同一 tenant/session/registration。

CURRENT 狀態：`operation-ui-next`

## 預約／美類營運者｜booking-admin

路徑：`/booking/`

對應模組：`tenant-operations`、`future-roadmap`

完成結果：預約工作、日曆、服務、資源、每週規則、臨時例外、空檔與到店流程共用正式 booking/operation tables。

CURRENT 狀態：`operation-ui-rebuild-required`

## 工程／專案營運者｜project-admin

路徑：`/project/`

對應模組：`tenant-operations`、`project-construction`

完成結果：工程專案正式資料根保留，construction_* 不可刪除；CURRENT 操作 UI 需重建。

CURRENT 狀態：`ui-missing-core-data-exists`

## 平台總管｜platform-admin

路徑：`舊 platform.html 已退休 → current compatibility → /workspace/#platform`

對應模組：`platform-access`、`platform-tenant`、`platform-billing`、`platform-products`、`platform-exposure`、`platform-support`、`platform-map`

CURRENT 狀態：`surface-missing-rebuild-required`

## 系統｜governance

路徑：`所有正式操作 → tobeloved-api → DOING_SaaS/public`

對應模組：`core-system`、`tenant-reporting`、`market-app-core`、`platform-map`

完成結果：後端先判會員、tenant、system entitlement 與角色，再讀寫單一正式 DB。

CURRENT 狀態：`preserve`

## CURRENT 禁止事項

- 禁止新開正式 route。
- 禁止用 `useCases` 猜登入後可使用系統。
- 禁止把三套系統全部畫出來再顯示「尚未確認權限」。
- 禁止同一會員為了加開系統建立第二個會員帳號。
- 禁止同一自有營運帳號為了加開系統建立第二個 tenant。
- 禁止系統開關刪除既有正式工作資料。
- 禁止修改 2BL。

## 重建順序鎖定

1. 會員 → tenant → `workModules` 權限閉環先完成。
2. `/apply/`、`/me/`、`/workspace/` 驗證正確後，再做 `/market/` 正式操作前台。
3. 市集完成後再做 `/project/`；美類操作 UI 另依排程重建。
4. 每個操作驗證 UI → API → DB → 刷新／重登 → 手機／桌機。
