# DOING 當前正式發布規則

狀態：CURRENT／最高優先／立即生效
更新：2026-08-25 Asia/Taipei

本文件只定義執行與發布口令；完整開發流程一律引用 `DOING_DEVELOPMENT_SOP_CURRENT.md`，不得在此另建第二套 SOP。

## 固定規則

1. 需求尚在溝通、尚未由使用者說「執行」前，不得修改、合併或部署。
2. 若工作涉及新操作路徑、角色流程、狀態流程或 Navigation Contract，使用者說「執行」後，先依 CURRENT SOP 完成 Prototype／Reverse Brainstorming，停在 Decision Gate。
3. Decision Gate 未經使用者確認，不得串正式功能、不得修改正式資料與權限邏輯、不得部署。
4. 使用者確認 Decision Gate 後，才進正式實作、Real-Browser E2E、Regression、Fix Until DoD、World Tree／ChangeLog，最後停在 Release Ready。
5. 正式部署必須收到明確「部署／發布」指令；Release Ready 不等於已部署。
6. 若使用者明確要求「只給檔案／不要部署」，完成檔案與驗證後不得合併或發布。
7. 不得把 CI PASS 誤稱為真人瀏覽器 UAT；能做 production browser UAT 時必須做，不能做時要留下 outstanding evidence。
8. 已通過項目禁止重做；問題只修 delta，從最近失敗 checkpoint 繼續。
9. 每批正式功能完成後更新 CURRENT World Tree／ChangeLog／Audit Trail；詳細歷史留 GitHub，Supabase 不堆疊重複開發紀錄。

## 當前口令

- 「執行」：開始本批工作；若有新路徑／新操作，先做到 Decision Gate。
- 「確認／照這版實作」：Decision Gate 通過，進正式實作直到 Release Ready。
- 「給我檔案／打包」：輸出 W／G／必要時 S＋交接語法；不部署。
- 「部署／發布」：將已通過 DoD 的 Release Ready 版本正式發布並做 production verification。

本規則自 2026-08-25 起取代舊的「執行後自動發布」規則。
