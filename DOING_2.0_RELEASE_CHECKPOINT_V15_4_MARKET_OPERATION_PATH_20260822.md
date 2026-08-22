# DOING 2.0｜v15.4 Market 操作路徑檢查點

狀態：Release Ready 前驗證中

## 本次完成

- 前台維持 7 步：活動探索 → 會員 → 報名 → 付款 → 排位 → 現場 → 歷史紀錄。
- 後台補齊為 9 步：後台入口 → 場次總覽 → 場次設定 → 待辦 → 審核 → 付款 → 排位 → 退款 → 財務結案。
- 系統閉環維持：操作 → DOING Core／API → Supabase → 重讀 → 畫面同步。
- 世界樹詳細圖可依每條路徑的實際節點數自動展開，不再硬限制後台只有 7 格。
- DOING 正式 LINE、角色、Workspace、Core、Supabase 機制不變。

## 不在本次修改範圍

- Market 業務功能本身。
- 2BL。
- Worker。
- Supabase Schema／正式資料。
- 正式發布。

## 發布條件

網站檢查與全系統安全檢查必須全部 PASS；完成後停在 Release Ready，等待明確發布確認。
