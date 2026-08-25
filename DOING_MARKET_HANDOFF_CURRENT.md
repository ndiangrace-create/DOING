# DOING Market｜交接 CURRENT

日期：2026-08-25（Asia/Taipei）
工作分支：`handoff/market-slug-apply-20260825`
正式基準：`main` @ `6e117926e883b8f6be99ab3811715e70f95838fc`
狀態：Handoff Ready；Draft PR #182；未合併；未部署。

## 本輪完成

1. `/apply/` 新增「系統帳號／網址代號」。
2. 系統帳號格式固定為英文小寫、數字、`-`，3–40 字；保留字前端阻擋。
3. 申請 payload 保存 `tenantSlug`、`requestedTenantSlug` 與 `routeContract`，沿用既有 application JSON，不新增資料表。
4. 申請頁依產品即時預覽：
   - `/market/{tenant-slug}/`
   - `/project/{tenant-slug}/`
   - `/booking/{tenant-slug}/`
5. `DOING_UI_ROUTE_SSOT_CURRENT.json` 與操作路徑樹已更新租戶網址規則。
6. 新增 DOING Market Route／Navigation Contract。
7. 新增使用者提供的 2BL Interaction Framework → DOING Market 操作參考，僅參考 UX／流程，不連 2BL 資料或 Worker。
8. E2E 測試已補系統帳號、網址預覽、保留字、申請 payload route contract 驗證。
9. 已建立 `DOING_MARKET_交接語法_CURRENT.txt` 與精簡 `DOING_MARKET_CHANGELOG_CURRENT.md`，供換新對話直接接續。

## 已鎖定架構

`產品 → tenant slug → 使用者權限`

- LINE／DOING member：人。
- `tenants.slug`：租戶公開網址代號。
- `market / project / booking`：產品分類。
- staff／owner／admin session：管理權限。

URL 只定位租戶，永遠不授權。會員 ID 不放 URL。

## DOING Market 定位

`/market/{tenant-slug}/` = 租戶對外公開的市集／活動頁，給攤商、參加者、一般民眾。

同頁保留隱藏租戶入口；隱藏手勢只發起 LINE／會員身分確認，必須由正式 tenant staff／owner 權限判斷後才可進操作模式。

## 2BL 操作參考鎖定

來源：`2BL_INTERACTION_FRAMEWORK_PACKAGE(2).zip`

DOING Market 下一階段必須保留：

`主導航 → 工作區 → 卡片 → 直接操作`

複雜操作最多：

`主導航 → 卡片 → 單一 Panel／Modal → 完成`

租戶操作 Level 1：

`場次｜待辦｜現場｜會員｜活動｜財務｜寄賣｜設定`

桌機只增加資訊密度；手機只改排列，禁止增加操作層級。

## 下一階段禁止直接實作的項目

動態 `/market/{tenant-slug}/` 路由、slug → tenant 解析、requested slug → `tenants.slug` 正式 provisioning 綁定、單場 route shape，都必須先依 SOP 完成 Role × State Matrix／Task Flow／Navigation Contract／Click-through Prototype／Reverse Brainstorming，停 Decision Gate 等使用者確認。

## 下一個新對話起點

只處理 DOING Market，不重做首頁、不重做已通過 application UI、不改 2BL。

固定 SOP：

`Baseline Sync → Module／DB／SSOT Lock → Multi-perspective → 依賴關係盤點 → Role × State Matrix → Task Flow → Navigation Contract → Click-through Prototype → Reverse Brainstorming → Decision Gate → 正式實作 → Real-Browser E2E → Regression → Fix Until DoD → World Tree／ChangeLog 更新 → Release Ready`

第一個交付：`/market/{tenant-slug}/` 的手機＋桌機 Click-through Prototype，流程／操作層級參考 2BL，視覺使用 DOING CURRENT。

## 驗證證據

- Draft PR：#182。
- DOING Kawaii Home：run `32848056019`，PASS。
- DOING Market Auth Role Separation：run `32848056029`，PASS。
- Chromium application/login/home E2E：PASS。
- 手機 390×844、桌機 1440×1000：PASS。
- 系統帳號欄位、網址預覽、保留字、application `tenantSlug`／`routeContract`：PASS。
- 正式 `W/worker.txt` 打包來源為 GitHub exact checkout；Git blob SHA `b1bde53075d4ad950dcc27c59be1428bc06dd9d5`。
- 僅供交接打包使用的 TEMP workflow 已移除，不存在於最終 branch diff。

## 安全邊界

- Supabase 為唯一正式營運資料來源。
- 既有 Module／DB／SSOT 鎖定，不重建、不重複建表、不改資料來源。
- 2BL 永久隔離；禁止修改 `2bl-v7`、2BL Supabase／DB／Repo／Routes／網域。
- 本輪 Worker：無變更。
- 本輪 Supabase schema／business data：無變更。
- 本輪正式部署：未執行。
