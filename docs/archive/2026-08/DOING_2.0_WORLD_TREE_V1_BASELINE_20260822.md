# DOING 2.0 世界樹 v1｜不可覆蓋基準

建立時間：2026-08-22 03:22 +08:00
基準 main：ab436273fad90e78edb79813bb14c1274ec8caf5
工作分支：feature/doing-market-2.0-20260822

## 版本治理

- 從本檔建立起，「2.0」固定指新的 DOING 操作架構。
- 舊 DOING 已開發功能、插件、API、資料表、權限與舊世界樹全部保留，不刪除、不覆蓋，視為「既有已開發能力庫」。
- 本檔只保存 v1 定案，不因後續優化而改寫。後續修改必須建立新版本或 ChangeLog。
- 2BL 只作 DOING Market UX／操作順序基準，不搬 2BL 資料庫。
- Supabase DOING_SaaS 仍是唯一正式資料來源；2.0 不重建資料庫。
- 同功能資料必須沿用現有正式資料表名稱；不得因重做 UI 建立同功能異名表。
- 真的需要新資料結構時，必須先證明現有資料表不能承載，並取得使用者明確確認後才能新增。
- 正式金額、名額、付款、退款、排位、權限不得由前端自行推算。
- 正式閉環固定：畫面 → API/Worker → Supabase → 重讀 → 畫面。

## 產品樹 v1

### DOING 2.0 Hub
- 單一會員登入
- 我的報名
- 我的營運
- 我的品牌
- 通知中心
- 客服／智慧小幫手
- 進入 DOING Market
- 進入 DOING Booking
- 進入 DOING Project

### DOING Market｜第一優先
範圍：市集／一般活動／體驗活動／DIY／工作坊。體驗不是補習班型課程，可掛在市集，也可獨立成活動。

主辦操作骨架固定沿用 2BL 熟悉順序：
1. 場次
2. 待辦
3. 現場
4. 會員
5. 設定

單場工作流：
建立場次 → 開放報名 → 收件 → 審核 → 錄取／候補／未錄取 → 繳費／付款回報 → 主辦確認 → 排位／設備 → 行前通知 → 現場 → 業績／保證金 → 結案。

現場過渡操作固定：
選場次 → 選「當日名單／該場次全名單」→ 搜尋姓名／品牌 → 找到正式報名 → 一鍵報到。
QR 功能需完整完成，但第一階段不強迫夥伴改用 QR。

付款第一階段固定沿用 2BL 習慣：
報名 → 審核 → 錄取 → 顯示應繳 → 攤商付款／回報 → 主辦確認 → 已繳費 → 行前通知。

### DOING Booking｜第二優先
核心 UX：日曆就是工作台。點日期直接新增預約；點既有預約直接修改；日期上直接加開／休息／封鎖；設定退到次要頁。
既有正式資料仍沿用 operation_units、service_items、resources、booking_calendars、availability_rules、availability_exceptions、timeslots、registrations、service_visits、customer_wallets、customer_wallet_ledger。

### DOING Project｜後續
既有能力保留，第一波不重建。

## 既有能力保存規則

完整既有能力以 doing-capabilities.json v21、doing-operational-world-tree.json、DOING_OPERATIONAL_WORLD_TREE.md、doing-data-sources.json 為既有能力與資料來源基準。
2.0 只重新排列操作層，不銷毀既有能力。

## v1 原始心智圖校驗值

- DOING_2.0_營運世界樹_全面版_20260822.md SHA-256：`8f2cc74e814317a70b3f3d9482d8bc777e30b24d5984e729d6ba2e7609b9755b`
- DOING_2.0_營運世界樹_全面版_20260822.mm SHA-256：`905322a14ed15e784d66a8fa597593d7a18be9dc6ce77e052c786a200cc8e146`

任何後續世界樹不得覆蓋此 v1 基準；只能另建新版本。