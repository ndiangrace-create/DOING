# DOING 2.0 世界樹 v12｜申請阻斷修正＋桌機固定頂部

日期：2026-08-22
狀態：修正中；不得覆蓋 v1–v11。

## 問題來源

- 正式申請頁前端已改成客服不作申請 gate，但 Worker `createOrganizerApplicationDraft` 仍要求 `assistantAnalysis.scope === 'doing_only'`。
- v11 前端送出的 scope 誤為 `application_compatibility`，因此正式站仍收到「請先完成 DOING 智慧小幫手整理並確認」。
- 共用外框 v7 已明確定案「固定頂部：DOING Logo／產品名稱／首頁／我的報名」，但 smart-application 尚未套用桌機固定頂部，造成已定案規則沒有完整落地。

## v12 修正

1. 正式申請送出 payload 的 `assistantAnalysis.scope` 改回 Worker 正式契約 `doing_only`。
2. 智慧小幫手仍為客服／導引，`customerServiceOnly=true`、`applicationGate=false`；不新增任何使用者確認步驟。
3. smart-application 桌機補上固定頂部：DOING／我要申請／首頁／我的報名；手機不硬塞桌機列。
4. 新增回歸測試：必須驗證前端 scope 與 Worker 契約一致；不得再出現舊 gate 阻斷。
5. 不新增資料表、不改 Schema、不改 2BL；Supabase 仍為 SSOT。
