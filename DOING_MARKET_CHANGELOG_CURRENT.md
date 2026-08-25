# DOING Market｜Current ChangeLog

更新：2026-08-26（Asia/Taipei）
範圍：DOING Market CURRENT 前台／主辦後台／單場工作台／報名／寄賣 POS 閉環。

## 2026-08-26｜2BL 操作框架補齊

- 正式前台只保留 `/market/public/` 一個入口；「立即報名」仍停留在同一 Market 前台開啟正式報名表單，不把 `/register/` 當正常使用入口。
- 正式後台只保留 `/market/` 一個入口；LINE 登入後自動辨識既有營運空間，已有權限者不要求重新申請。
- 後台 Level 1 固定：`場次｜待辦｜現場｜會員｜活動｜財務｜寄賣｜設定`，桌機左側直排，手機僅改排列、不增加導航層級。
- 寄賣／POS 已由假入口改為同一 Market 後台直接操作：檔期、申請審核、商品、庫存、POS 銷售。
- 寄賣沿用正式 Core：`getOperationalCloseout / saveConsignmentPeriod / reviewConsignmentApplication / saveConsignmentProduct / recordPosSale`。
- 正式 DB RPC `record_consignment_pos_sale` 已核對：POS 以 `productId + quantity` 原子扣庫存，並寫入 `pos_sales / pos_sale_items / inventory_movements / finance_ledger`；前端不自行扣庫存、不另建財務資料。
- 會員頁新增同頁「參與歷史／主辦備註」，沿用 `getMemberHistory / saveMemberNote`，不建立第二套 member 資料。
- 設定頁新增同頁五個正式入口：收款設定、合約／規範、團隊／權限、常用場地圖、系統客服；均直接讀既有 Core，不另開第二套設定資料。
- 新增 `DOING Market Admin 2BL Parity` Chromium E2E，逐一點擊會員歷史／備註、寄賣檔期／審核／商品／POS、五個設定入口。
- PR #187 最新 checkpoint `4e9964465bd6b1d2d9456bdd6fc5dd6795ab5a8b`：Market Admin 2BL Parity PASS、Market Entry PASS、Market Auth Role Separation PASS、DOING Kawaii Home PASS。

## SSOT／安全邊界

- Worker：0 變更；正式 Core 仍是 `tobeloved-api`。
- Supabase schema：0 變更。
- 2BL／`2bl-v7`：0 變更、0 部署；2BL 只作操作框架與排列參考。
- CI／E2E 寫操作使用 mock contract 驗證，未對正式營運資料進行測試寫入。
- 不建立第二套會員、報名、付款、排位、通知、退款、寄賣、庫存或財務資料根。

## 既有 Market CURRENT 基準

- `/market/`：正式主辦操作首頁。
- `/market/public/`：正式攤商／參加者單一前台。
- `/market/session/`：後台點單場後的內部工作台，不是第三個入口。
- `/register/`：保留既有相容 route，但不列為 Market 正常入口。
- 單場工作固定：`總覽｜報名審核｜付款｜排位／設備｜通知｜現場｜退款／結案｜場次設定`。
- 主辦正式 API 統一送出 `tenant + admin_token + JWT email`；不以前端 URL 或畫面狀態授權。
- 審核：`updateRegStatus`；錄取時由後端建立正式付款快照與名額調整。
- 排位：`adminSeatBoard / adminAssignSeat / adminUnassignSeat / runBatchAssign`。
- 設備：`updateSession.equip / getSessionEquipmentDetails`。
- 通知：`sendNotify / sendPaymentReminder`。
- 現場：`checkin`。
- 退款：`getRefundSuggestion / confirmRefund`。
- 財務：`financeReport / financeOverview`。

## 驗證與發布紀錄

- 2026-08-25：2BL-aligned Market 前台已完成 Cloudflare Pages 正式部署，build、Real-Browser、正式網域綁定均 PASS。
- 2026-08-26：PR #187 新增後台完整操作 parity；最新 head 四條 gate 已全綠。
- 發布授權：使用者已明確授權，DoD 全綠後直接 merge `main` 並部署正式 DOING，不再停在 Release Ready 等第二次確認。

## 尚未納入本輪

- `requestedTenantSlug` 正式 provisioning → `tenants.slug` 與 `/market/{tenant-slug}/` 動態漂亮網址仍是獨立 route-provisioning 工作；不得用此項否定本輪 `/market/?tenant=` 正式操作閉環。
- Project／Booking 不在本輪功能擴寫範圍，只做 regression 保護。
