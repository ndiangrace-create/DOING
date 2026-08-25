# DOING｜統一正式工作指令 CURRENT

## 唯一開發 SOP

所有 DOING 開發、操作路徑設計、Prototype、正式實作、E2E、Regression、DoD 與 Release Ready 流程，一律以 `DOING_DEVELOPMENT_SOP_CURRENT.md` 為唯一正式 SOP SSOT。

不得在其他文件另寫第二套流程；若舊文件與 CURRENT SOP 衝突，以 `DOING_DEVELOPMENT_SOP_CURRENT.md` 為準。

## 開工前固定動作

開始任何頁面、API、Worker、資料庫或功能工作前，必須先：

1. 讀最新 `main`、CURRENT SSOT 與最後成功 checkpoint。
2. 核對 live Supabase `DOING_SaaS / nayonqbzejoojexxxkyg`。
3. 鎖定既有 Module／DB／API／正式 route／資料來源，不得自行猜測、改名、複製或建立第二套同義資料。
4. 若工作涉及新操作路徑或路徑改動，先依 CURRENT SOP 做到 Decision Gate；使用者確認後才正式實作。

## 完成判準

正式實作後的驗收單位固定為：

`角色／狀態 → 實際點擊 → 畫面 → 權限 → API → DB 讀寫 → 狀態變更 → 下一步 → 返回 → 重新整理／重登 → 手機／桌機 → Regression`

只驗按鈕存在、DOM 存在或 CI 綠燈都不算完整驗收。

## 安全邊界

- Supabase 是唯一正式營運資料來源。
- 2BL 與 DOING 永久隔離，不得修改 `2bl-v7` 或 2BL 的 Worker／Routes／Secrets／Supabase／DB／GitHub／網域。
- `worker.js / worker.txt` 必須一致。
- 不得自行新增正式網址；任何 route 先對照 CURRENT Route SSOT／Operation Path Tree。
- 不得自行修改計費。
- 發現問題只修 delta，不重做已通過項目。
- Atomic Checkpoint＋Audit Trail 貫穿每一階段；詳細歷史留在 GitHub，Supabase 只保留單一 CURRENT SOP 紀錄。
