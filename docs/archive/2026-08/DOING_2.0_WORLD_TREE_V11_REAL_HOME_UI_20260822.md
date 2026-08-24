# DOING 2.0 世界樹｜v11 真實首頁 UI＋共用色系

日期：2026-08-22

## 定案

- 根首頁是一般民眾入口，不再顯示內部 Hub／Core／產品架構說明。
- 首頁搜尋框在最上方，正式 DOING PNG LOGO 放在搜尋框下方。
- 首頁保留「近期場次」，直接讀既有 `publicDiscovery`，使用 2BL 習慣的小卡片呈現：封面、類型、名稱、日期、地點、立即報名。
- 底部三個主要操作固定只有文字：`報名活動`／`我的紀錄`／`線上客服`，不放圖示。
- `我要申請 DOING` 保留為次要入口。
- 首頁搜尋帶 query 至 `/market/public/`；立即報名進 `/register.html?tenant=...&session=...`；我的紀錄進 `member-panel`；客服沿用既有 DOING 問答 API。

## 視覺 SSOT

- 新增 `doing-candy-theme.css` 作 DOING 2.0 共用視覺 token。
- 色系：粉藍、粉紫、嫩綠、奶油黃，首頁可使用粉色搜尋框。
- 按鈕：方形大圓角、立體厚度、底部陰影、按下下沉。
- 共用色系套用 DOING 2.0 主要公開／營運頁面；只改視覺，不修改業務狀態、權限、API 或資料來源。

## 安全邊界

- 新資料表：0
- Schema 變更：0
- Worker 業務邏輯變更：0
- 2BL 變更：0
- Supabase 仍為正式資料 SSOT。

## 驗證

- DOING 2.0 Site #67：PASS
- DOING Market 2.0 Validation #102：PASS
- DOING Safe Production #541：PASS
- Cloudflare audit：PASS
- `scripts/validate-home-real-ui-v11.mjs`：PASS
- `scripts/validate-doing-v11-home-e2e.mjs`：PASS

## DoD

目前程式、自動 E2E、全系統回歸與安全驗證已通過。合併 main 後由正式 Pages 流程部署，再進正式網址真人視覺／點擊 UAT。
