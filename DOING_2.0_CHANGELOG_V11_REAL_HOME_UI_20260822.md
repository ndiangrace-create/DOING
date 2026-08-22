# DOING 2.0 ChangeLog｜v11 真實首頁 UI

日期：2026-08-22

- 將使用者核定的首頁視覺真正實作為系統首頁，不再只保留示意圖。
- 搜尋框調整到 LOGO 上方；正式 DOING PNG LOGO 顯示於搜尋框下方。
- 首頁新增正式「近期場次」資料區，直接讀 `publicDiscovery`。
- 場次呈現沿用 2BL 熟悉的小卡片資訊密度與立即報名操作。
- 底部三個主按鈕改為純文字：報名活動／我的紀錄／線上客服。
- 新增 `doing-candy-theme.css`，將粉藍／粉紫／嫩綠／奶油黃與立體按鈕回饋套用到 DOING 2.0 主要頁面。
- 首頁不再先出現內部 Hub／Core／產品架構說明。
- 新增 `scripts/validate-home-real-ui-v11.mjs`，更新首頁與產品頁回歸測試。
- DOING 2.0 Site #67 PASS、DOING Market 2.0 Validation #102 PASS、DOING Safe Production #541 PASS、Cloudflare audit PASS。
- 新資料表 0、Schema 變更 0、Worker 業務邏輯變更 0、2BL 變更 0。
