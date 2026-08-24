# DOING 2.0 ChangeLog Append｜v10｜2026-08-22

本檔為 `DOING_2.0_CHANGELOG.md` 的 append-only v10 延伸紀錄；不覆寫 v1～v9 歷史。

## 固定產品智慧申請

- 「我要申請」固定導向 `/smart-application.html`。
- 智慧小幫手不再用舊版自由工作分類／角色猜測。
- 固定產品：DOING Market／DOING Project／DOING Booking／DOING Guide。
- DOING Market 固定定位為主辦營運系統；移除「我是主辦／我是攤商參與者／兩種都有」申請分流。
- Market 使用類型：市集／一般活動／體驗活動／DIY。
- Project 固定室內設計／工程主流程：客戶 → 案件 → 現勘 → 報價 → 設計 → 圖面 → 選材 → 工程 → 工班 → 進度 → 追加減 → 驗收 → 收款 → 結案。
- Booking 固定美類／一般服務預約；Guide 固定導覽員／導覽預約。
- 智慧申請只顯示／套用既有正式模組，不允許 AI 自行建立新產品、新模組或新資料表。
- 申請資料 `application_json.activationProfile.version=5`，並記錄 `architecture=doing_2_fixed_products`、products、subtypes、modules，供後續介面與權限設定同步使用。
- 正式申請順序固定：我要申請 → 固定產品 → 使用類型 → 固定模組 → 確認 → 正式資料 → LINE 驗證 → 自動開通 → 我的 DOING → 對應產品。
- 新資料表 0、Schema 變更 0、Worker 正式邏輯變更 0、2BL 變更 0。

## 驗證

- DOING Market 2.0 Validation #82：PASS。
- DOING 2.0 Site #40：PASS（含 fixed product application validator）。
- DOING Safe Production #514：PASS。
- Cloudflare audit：PASS。
- production deploy：skipped（PR 階段）。

狀態：Release Ready，等待確認發布。
