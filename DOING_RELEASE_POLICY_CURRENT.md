# DOING 當前正式發布規則

狀態：CURRENT／最高優先／立即生效
更新：2026-08-26 Asia/Taipei

本文件只定義執行與發布口令；完整開發流程一律引用 `DOING_DEVELOPMENT_SOP_CURRENT.md`，不得在此另建第二套 SOP。

## 固定規則

1. 需求尚在溝通、尚未由使用者說「執行」前，不得修改、合併或部署。
2. 若工作涉及新操作路徑、角色流程、狀態流程或 Navigation Contract，使用者說「執行」後，先依 CURRENT SOP 完成 Prototype／Reverse Brainstorming，停在 Decision Gate。
3. Decision Gate 未經使用者確認，不得串正式功能、不得修改正式資料與權限邏輯、不得部署。
4. 使用者確認 Decision Gate 後，進正式實作、Real-Browser E2E、Regression、Fix Until DoD、World Tree／ChangeLog。
5. 使用者已對 DOING 專案給予持續發布授權：「檢查沒問題就部署、階段性前進」。因此每個可獨立驗收的 Atomic Checkpoint，只要該階段 phase-specific Real-Browser E2E、Regression、DoD 全綠，即直接 merge／deploy／production verify，不再重複詢問「是否部署」。
6. 未來尚未完成的其他階段不得阻塞已完成階段發布；已部署且 PASS 的階段視為正式 checkpoint，後續只做增量，不重做。
7. 若當前階段有紅燈，只阻擋該階段；修最近失敗 delta 後重驗，通過即部署。
8. 若使用者明確要求「只給檔案／不要部署」，完成檔案與驗證後不得合併或發布；此為自動部署授權的唯一明確暫停條件。
9. 不得把 CI PASS 誤稱為真人瀏覽器 UAT；能做 production browser UAT 時必須做，不能做時要留下 outstanding evidence。
10. 已通過項目禁止重做；問題只修 delta，從最近失敗 checkpoint 繼續。
11. 每批正式功能完成後更新 CURRENT World Tree／ChangeLog／Audit Trail；詳細歷史留 GitHub，Supabase 不堆疊重複開發紀錄。

## 當前口令

- 「執行」：開始本批工作；若有新路徑／新操作，先做到 Decision Gate。
- 「確認／照這版實作」：Decision Gate 通過，進正式實作；本階段驗證全綠後自動發布並繼續下一階段。
- 「給我檔案／打包」：輸出 W／G／必要時 S＋交接語法；若同時明確說「不要部署」，則不部署。
- 「部署／發布」：立即發布已通過該階段 DoD 的版本並做 production verification；不必再次詢問。
- 「檢查沒問題就部署／繼續」：視為持續授權，後續各 Atomic Checkpoint 依本規則自動發布。

本規則自 2026-08-26 起取代 2026-08-25 的「每次 Release Ready 都需再次要求部署」規則。
