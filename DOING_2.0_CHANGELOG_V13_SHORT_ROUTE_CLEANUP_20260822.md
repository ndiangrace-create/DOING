# DOING 2.0 ChangeLog v13｜2026-08-22

本次為 DOING 2.0 前端網址與頁面層級整理；DOING 公開平台不重做。

已完成：
- 正式 Pages 僅發布短網址層級：Market、Project、Booking、Guide、Workspace、會員／我的紀錄、申請、報名。
- 不再發布舊根層 `.html` 公開頁。
- `admin`／`onsite`／`platform`／`operations`／`photo`／`consignment`／`about`／`member` 不再是獨立公開頁，也不留 redirect。
- 設定與現場歸回 Market；平台／營運層歸回 Workspace。
- 我的紀錄固定 `/me/`；申請固定 `/apply/`；LINE 與申請完成回跳不再繞首頁。
- 新增建置硬性檢查：舊 `.html`、舊頁引用、多餘獨立路由重新出現即失敗。
- 桌機首頁頂部列驗證為真正 fixed；手機規則保持。

驗證結果：Site #86 PASS；Market #118 PASS；Safe Production #564 PASS；Cloudflare audit PASS。正式資料寫入 0；Worker／Schema／2BL 0 變更。

目前停在 Release Ready，待確認後才合併 main 與正式部署。
