# DOING｜統一正式工作指令 CURRENT

## 核心規則

開始任何資料庫、API、頁面或功能開發前，必須先讀 CURRENT SSOT，並以 live Supabase `DOING_SaaS / nayonqbzejoojexxxkyg` 核對。

已存在的功能、資料表、API、handler、頁面與檔案名稱一律沿用；不得自行猜測、改名、複製或建立第二套同義資料。若文件與 live Supabase 不一致，以 live Supabase 為準並更新同一份 CURRENT SSOT。

目前階段是「操作頁面設計＋操作結果驗收」。驗收單位固定為：

`操作前狀態 → 使用者操作 → 畫面結果 → API → DB → 重新整理 → 重登 → 角色／租戶 → 手機／桌機 → Regression`

只有 UI、API、DB、權限、持久化、角色／租戶隔離與手機／桌機結果全部一致，才算完成。

## 安全邊界

- Supabase 是唯一正式營運資料來源。
- 2BL 與 DOING 永久隔離，不得修改 `2bl-v7` 或 2BL 的 Worker／Routes／Secrets／Supabase／DB／GitHub／網域。
- `worker.js / worker.txt` 必須一致。
- 未收到明確發布指令不得正式部署；收到明確發布授權後，依 CI／回歸結果完成正式部署與 production verification。
- 發現問題只修 delta，不重做已通過項目。
- 每次完成須留下 checkpoint、change log 與可核對驗證證據。
