# Market 公開前台｜2BL 框架修正 2026-08-23

- 來源：2BL 正式 `main/index.html` 前台框架 + DOING Market 世界樹。
- 只修 `/market/public/` 前台，不搬 2BL Worker/Supabase。
- 保留 DOING LINE／會員、DOING Core、Supabase SSOT、`/register/` 正式報名。
- 前台順序：Header → 可選租戶封面 → 搜尋 → 小型分類 → 近期活動 → 全部活動。
- 封面未設定時不顯示空白 placeholder。
- 桌機內容寬度 1160px；Header 約 60px；搜尋 44px；分類卡 94px；第一屏可看到活動內容。
- 活動日期由近到遠；圖片 1:1；手機分類 2 欄、活動列表採緊密 1:1 小圖；手機固定底部首頁／會員／客服。
- 前台只顯示使用者需要的內容，不顯示工程資訊。
