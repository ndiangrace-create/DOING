# DOING 2.0 World Tree v9｜Market v18 重建

日期：2026-08-23
基準：main `f9305398cc950576a52d9874f4b265bf78bea450`
範圍：只重建 DOING Market UI／導覽層；不回滾 Core、API、Supabase SSOT、角色權限與既有正式資料。

## 固定操作世界樹

### 前台
活動探索 → 會員 → 報名 → 付款 → 排位／設備 → 現場 → 歷史紀錄

### 主辦後台
後台入口 → 場次總覽 → 場次設定 → 待辦 → 審核 → 付款 → 排位 → 退款 → 財務結案

### 單場工作台
總覽 → 報名審核 → 付款 → 排位設備 → 通知 → 現場 → 結案 → 場次設定

## v18 畫面對應

- `/market/public/`：前台活動探索。租戶 LOGO／封面／介紹由既有 `getSiteConfig`／`saveSiteConfig` 管理；活動依最近日期排序；活動卡直接進 `/register/`。
- `/market/`：主辦場次總覽、待辦、現場、會員、設定。場次卡每個數字都是按鈕。
- `/market/session/`：指定場次的報名審核、付款、排位設備、通知、現場、結案與設定。

## 雙向任督二脈

場次卡數字 → 對應單場名單篩選 → 執行正式 API 操作 → 重讀 `getSessionRegistrations`／`getSessionsAdmin` → 原場次數字同步更新。

固定數字對應：
- 報名 → 全部報名名單
- 待審核 → 待審核名單
- 待繳費 → 待繳費名單
- 待確認付款 → 付款待確認名單
- 已繳費 → 已繳費名單
- 已報到 → 現場已報到狀態

## 導覽鎖

Market 正式使用者操作只允許短網址：
- `/market/public/`
- `/market/`
- `/market/session/`
- `/register/`
- `/me/`
- `/workspace/`

禁止重新導向 `admin.html`、`market-center.html`、`market-public.html`、`market-session.html` 或其他舊長網址。

## 視覺鎖

- 單一 `doing-market-v18.css`
- 舊 Market 視覺 overlay 不進正式建置
- 方形小圓角，不使用膠囊
- 不使用漸層
- 活動圖片固定 1:1
- 桌機 5～6 張小卡／行
- 手機 2 張／行
- 桌機固定上方列；客服在上方
- 手機才顯示底部三固定操作
- 前後台使用同一套 Design System
- 前後台只顯示該角色需要看的內容，不顯示 API／資料表／工程說明

## 資料與權限

- 新資料表：0
- Supabase Schema 變更：0
- Worker 變更：0
- 2BL 變更：0
- 正式資料仍由 DOING Core/API + Supabase SSOT 裁決

## 驗收

必須同時通過：靜態契約、資料來源、角色權限、Market 閉環、手機／桌機 Chromium click-through、截圖證據、全系統 regression、Safe Production。

未通過以上項目，不得標示 Release Ready／不得部署。
