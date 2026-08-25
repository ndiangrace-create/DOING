# DOING Market｜Current ChangeLog

更新：2026-08-25（Asia/Taipei）
範圍：DOING Market CURRENT 前台／主辦後台／單場工作台／報名路徑閉環。

## 本輪 Delta

- 保留 `/apply/` 既有 tenant slug 申請與 route contract；不重做已通過申請／登入／workspace。
- `/market/` 由介紹頁升級為正式主辦操作首頁。
- `/market/public/` 由 rebuild shell 升級為正式攤商／參加者前台。
- `/market/session/` 由 rebuild shell 升級為正式單場工作台。
- `/register/` 恢復成熟 `register.html` 報名流程；build 只增加 root base 相容，不重寫報名核心。
- 主辦 Level 1 固定：`場次｜待辦｜現場｜會員｜活動｜財務｜寄賣｜設定`。
- 單場工作固定：`總覽｜報名審核｜付款｜排位／設備｜通知｜現場｜退款／結案｜場次設定`。
- 前台路徑固定：`活動 → 活動內容 → 報名 → 我的紀錄 → 審核／付款／位置／現場狀態 → 客服`。
- 主辦正式 API 統一送出 `tenant + admin_token + JWT email`；不以前端 URL 或畫面狀態授權。
- 審核沿用 `updateRegStatus`；錄取時由後端建立正式付款快照與名額調整。
- 排位沿用 `adminSeatBoard / adminAssignSeat / adminUnassignSeat / runBatchAssign`。
- 設備沿用 `updateSession.equip` → 正式 `equip_json`；設備使用沿用 `getSessionEquipmentDetails`。
- 通知沿用 `sendNotify / sendPaymentReminder`。
- 現場沿用 `checkin`。
- 退款沿用 `getRefundSuggestion / confirmRefund`。
- 財務沿用 `financeReport / financeOverview`。
- 會員沿用 `getPlatformMemberProfile / savePlatformMemberProfile / getMyRegsGlobal`。
- CURRENT build 已改為正式輸出上述 Market 路由，不再把 public/session/register 當 rebuild shell。

## SSOT／安全邊界

- Worker：0 變更；正式 Core 仍是 `tobeloved-api`。
- Supabase schema：0 變更。
- 正式 business data：本 PR/CI 0 寫入；CI 寫操作使用 mock contract 驗證。
- 2BL／`2bl-v7`：0 變更、0 部署。
- 不建立第二套會員、報名、付款、排位、通知、退款或財務資料根。

## 驗證與修正紀錄

- CURRENT build：PASS，`/market/`、`/market/public/`、`/market/session/`、`/register/` 均為 live route。
- Route／SSOT 靜態 contract：PASS。
- DOING Market Auth Role Separation：PASS。
- Booking regression：PASS。
- 第一輪 Real-Browser Market E2E：FAIL；原因為測試先切到「現場」後直接點隱藏於「場次」頁的「新增場次」，屬 E2E 測試狀態順序錯誤，產品 UI 未判定失敗。
- 修正：E2E 在現場快速入口驗證後先切回 `sessions`，再點「新增場次」；commit `c4374a609add55c27ab6e449f7b738ee3a4c2206`。
- 最終 Chromium 桌機 1440×1000＋手機 390×844、整站 regression 與 deployment 結果：以 PR #182 最新 workflow／production verification 為發布證據，不得在全綠前誤稱完成。

## 發布授權

使用者已於 2026-08-25 明確授權：`Real-Browser E2E → Regression → Fix Until DoD` 全綠後，直接 merge `main` 並部署正式 DOING，不再停在 Release Ready 等第二次確認。

## 尚未納入本輪

- `requestedTenantSlug` 正式 provisioning → `tenants.slug` 與 `/market/{tenant-slug}/` 動態漂亮網址仍是獨立 route-provisioning 工作；不得用此項否定本輪 `/market/?tenant=` 正式操作閉環。
- Project／Booking 不在本輪功能擴寫範圍，只做 regression 保護。
