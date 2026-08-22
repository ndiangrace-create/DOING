# DOING 2.0 世界樹 v14｜全站視覺系統＋Flat IA

日期：2026-08-22
狀態：實作中 → 驗證通過後自動發布
範圍：DOING 2.0；DOING 公開首頁本批不修改

## 唯一操作基準
- 2BL 僅作操作順序／UX 骨架參考，不修改 2BL 正式系統。
- 系統閉環固定：按鈕 → Worker → Supabase → 重讀 → 畫面。
- Supabase 為正式 SSOT；前端不得自行推算正式金額、付款、退款、活動金、押金、名額、排位或權限。

## 本批視覺 SSOT
使用者提供的 DOING 視覺圖片為唯一視覺基準：乾淨、明亮、低飽和、卡片節奏清楚、一般人容易操作。

## Design System
- 背景：米白／乾淨淺色。
- 輔色：粉藍、淡綠、淡黃、淡紫；粉紅不得成為主色。
- 文字：深灰／黑。
- 無漸層、無灰霧、無紫金、無廉價發光。
- 細邊框、輕陰影、10–18px 方形小圓角。
- 統一按鈕、表單、卡片、表格、狀態標籤、導覽、彈窗、載入／空白／錯誤狀態。

## Flat IA
- 主功能集中在同一工作空間。
- 一般操作最多兩層。
- 設定、審核、備註、狀態修改優先頁內完成。
- 頁內分頁保留目前工作狀態與捲動位置。
- Market 主工作區保留：場次／待辦／現場／會員／設定。
- 單場完整流程保留 `/market/session/`。

## 固定頂部列
- 桌機與主要工作頁：滑動時固定在最上方。
- LOGO 左上且可回首頁／工作入口。
- 手機斷點重新設計，不遮字、不爆版。

## 正式短網址
- `/market/`
- `/market/public/`
- `/market/session/`
- `/project/`
- `/booking/`
- `/guide/`
- `/workspace/`
- `/me/`
- `/apply/`
- `/register/`

## 安全邊界
- Worker：0 schema change。
- Supabase：0 schema change。
- 2BL：0 change。
- 正式業務資料：0 migration。
- DOING 公開 root：本批不套用新 visual system。

## DoD
1. 所有 DOING 2.0 正式短網址載入同一 Design System。
2. 頂部列確實使用 fixed，而非僅顯示。
3. 手機與桌機都有獨立響應式驗證。
4. 無舊 `.html` 正式公開頁回歸。
5. 既有功能、API、權限、SSOT 回歸全綠。
6. CI 全綠後依最新發布規則直接合併 main 並部署。
7. 正式網域 production verification 如環境可達則完成；不可達必須留下 outstanding evidence，不得假稱真人 UAT PASS。
