# DOING 營運世界樹

更新：2026-08-25  
正式機器契約：`doing-operational-world-tree.json`

## 它是什麼

營運世界樹不是功能清單。它是一張跟著 DOING 正式系統更新的活地圖，固定回答：

> 誰 → 從哪裡進入 → 按什麼 → 到哪一頁 → 需要什麼會員／租戶／系統／角色權限 → 經過哪個 API → 讀寫哪些 Supabase 資料 → 狀態如何改變 → 怎樣算完成 → 下一步或返回哪裡。

`doing-capabilities.json` 繼續保存能力盤點，不得再被畫面或文件稱為世界樹。

## 四個固定層次

1. 角色：一般使用者／報名者、品牌使用者、營運申請者、租戶擁有者／主辦管理員、現場工作人員／實際出攤者、平台總管。
2. 使用路徑：入口、操作、完成結果、下一步與返回。
3. 系統支撐：頁面、會員、租戶、system entitlement、角色權限、Worker action、Supabase 資料與狀態變化。
4. 開發狀態：已完成、待確認、真正阻斷、稍後開發、待真人驗證。

## CURRENT 會員／租戶／系統權限 SSOT

DOING 正式模型固定為：

> **一個 DOING／LINE 會員 → 一個自有營運 tenant/workspace → tenant 可開通多個工作系統。**

這三層不得再混用：

- **會員本人**：`platform_members`＋`platform_member_identities`。
- **自有營運帳號**：`tenants`＋`staff.platform_member_id`。
- **已開通系統**：`tenant_settings.module_flags_json.workModules`。

目前公開系統 key：

- `market` → `/market/`
- `project` → `/project/`
- `booking` → `/booking/`

同一 tenant 的共用會員／顧客／團隊等資料可以共用；市集、工程、預約的工作紀錄仍依各自正式資料表與工作類型分類，不因共用 tenant 而混成同一筆工作資料。

### LINE 登入正式判斷

`/me/ → LINE OAuth → member token → getPlatformMemberProfile → createMemberWorkspaceAdminSession → getTenantModuleProfile → approvedFlags.workModules`

規則：

1. 只有一套 `workModules=true`：直接進該系統首頁。
2. 有多套：`/me/` 只顯示真正已開通的系統。
3. 未開通：完全不顯示，不出現「尚未確認權限」假卡片。
4. `useCases`、舊 `moduleProfile.useCases`、品牌名稱、UI 文案皆不得當成登入授權依據。
5. LINE 只解析會員本人；真正可使用哪一套系統由 tenant entitlement 決定。

## 首頁三個公開分類主幹

- 市集：`/ → /apply/?system=market → LINE → system entitlement → /market/`
- 工程：`/ → /apply/?system=project → LINE → system entitlement → /project/`
- 美類：`/ → /apply/?system=booking → LINE → system entitlement → /booking/`

申請資料格式共用，但 `requestedSystem` 決定這一次只開通哪套系統。

若會員已經有自有 tenant，新增系統必須加到原 tenant；只有第一次申請才建立 tenant。不得為了加系統建立第二個會員或第二個自有 tenant。

## 九條正式主幹

1. 找到活動到完成報名
2. 建立品牌到成員權限生效
3. 系統申請到同一自有營運帳號的 system entitlement
4. LINE 登入到正確系統入口
5. 主辦後台完整營運
6. 現場授權到報到完成
7. 平台總管例外處理閉環
8. 正式資料與租戶／系統隔離
9. 唯一正式入口與舊架構退休

## 系統申請主幹

申請路徑：

> `/apply/?system=<key>` → 填共同基本資料 → LINE 驗證 → 找到本人 member → 找到本人自有 tenant → 檢查 `workModules` → 加開本次 system → 直接進對應 CURRENT route。

結果規則：

- 無自有 tenant：建立第一個自有 tenant 並只開通本次 system。
- 已有自有 tenant：只 merge 本次 system entitlement，tenant id 不變。
- 已開通相同 system：拒絕重複申請。
- 多自有 tenant／身分衝突：fail closed，轉人工確認，不猜目標 tenant。

正式資料：`tenant_apply_logs`、`platform_members`、`platform_member_identities`、`tenants`、`tenant_settings`、`staff`。

## 通用預約工作模組

預約不是夜貓美甲專案，也不是美類專用資料根；它是工作模組之一，任何服務型 tenant 都沿用同一組正式資料。

CURRENT 公開分類 `/booking/` 是 booking system 的固定 route；操作 UI 可重建，但不得另建會員、預約、付款、日曆或通知資料。

預約資料根：`operation_units`、`service_items`、`resources`、`booking_calendars`、`availability_rules`、`availability_exceptions`、`timeslots`、`registrations`、`service_visits`。

服務時間、訂金、緩衝、可選起始間隔與同顧客間隔均由正式資料計算。任何單一驗證租戶都不能成為資料模型或 UI 邏輯來源。

## 市集系統

CURRENT route：`/market/`；單場 route：`/market/session/`。

System entitlement：`workModules.market=true`。

正式工作資料持續使用 `events`、`sessions`、`operation_units`、`registrations`、`payments`、`refunds`、`seat_*`、`finance_*` 與現場相關正式表，不建立第二套市集資料根。

## 工程進度系統

CURRENT route：`/project/`。

System entitlement：`workModules.project=true`。

正式工作資料使用既有 `construction_projects`、`construction_members`、`construction_stages`、`construction_updates`、`construction_quotes`、`construction_payments`、`construction_expenses`、`construction_signoffs`，不可另開同功能異名表。

## 系統權限與資料分類規則

- `workModules` 只決定「這個 tenant 可以進哪個系統入口」。
- 共用能力旗標仍保留在 `tenant_settings.module_flags_json`，多系統 tenant 採能力 union，不把既有 true 關掉。
- `tenants.config_json.enabledSystems` 與 `systemProfiles` 保存可追溯系統設定；正式入口授權仍以 `tenant_settings.module_flags_json.workModules` 為唯一判斷。
- 停用入口不得刪除歷史資料。
- 後端角色權限仍是 API 最終裁決，不因前端顯示而放寬。

## 狀態規則

- 已完成：程式、固定契約與自動驗證均已通過。
- 待確認：功能存在，但仍需正式資料或指定情境確認。
- 真正阻斷：已確認會讓角色無法繼續的流程問題。
- 稍後開發：不在目前正式完成範圍，沒有假裝完成。
- 待真人驗證：只能由真人、真機或第三方正式環境完成。

LINE OAuth、LINE 內建瀏覽器、正式本人登入與第三方環境不可因模擬 E2E 通過而冒充真人驗收。

## CURRENT 開發順序

1. 先完成會員 → tenant → system entitlement → route 的閉環。
2. 完成 `/apply/`、`/me/`、`/workspace/` 的真實 LINE／正式資料 UAT。
3. 再建 `/market/` 正式操作前台。
4. 市集完成後接 `/project/`。

## 更新鐵律

- 正式按鈕、route、會員、tenant、system entitlement、角色、API、Supabase 資料根、狀態、完成結果或真人驗證有變動時，必須同步更新營運世界樹。
- Supabase 是正式營運資料唯一來源；世界樹只保存路徑與驗收契約，不另建業務資料。
- 不新開 CURRENT 正式 route。
- 不用 `useCases` 猜 system entitlement。
- 不碰 `2bl-v7`，DOING 與 2BL 永遠分開。
- 不自行修改計費。
