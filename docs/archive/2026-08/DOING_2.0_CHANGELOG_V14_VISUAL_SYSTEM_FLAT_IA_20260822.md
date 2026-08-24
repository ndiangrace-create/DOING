# DOING 2.0 ChangeLog v14｜全站視覺改造＋Flat IA

日期：2026-08-22

## 需求來源
依使用者提供的唯一視覺基準與 2BL 營運世界樹操作流程，重做 DOING 2.0 視覺系統；不更動既有功能契約、API、Supabase、登入與角色權限。

## 變更
- 新增 `doing-visual-system-20260822.css`：統一色彩、字級、間距、內容寬度、圓角、陰影、按鈕、表單、卡片、表格、狀態、導覽、彈窗與狀態畫面。
- 新增 `doing-visual-system-20260822.js`：路由頁面 class、工作狀態／捲動位置保存、空白保護與工程字樣隱藏。
- DOING 2.0 所有正式短網址統一載入同一 Design System。
- 桌機與主要工作頁頂部導覽鎖為真正 `position: fixed`。
- Flat IA：頁內 tabs／settings 保持同一工作空間，不以視覺改造新增新頁。
- Market 仍以場次／待辦／現場／會員／設定為主要工作區，單場保留 `/market/session/`。
- DOING 公開 root 本批不套用新版 visual system。

## 不變
- `tobeloved-api` Worker contract 不變。
- Supabase schema／正式業務資料不變。
- 2BL 正式 repo、Worker、Supabase 不變。
- 正式短網址層級不變。

## 驗證
由既有 Site／Market／Safe Production pipelines 與擴充的 shell validator 驗證；全綠後依 `DOING_RELEASE_POLICY_CURRENT.md` 自動合併及發布。
