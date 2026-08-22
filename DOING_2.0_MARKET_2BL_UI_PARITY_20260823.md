# DOING Market｜2BL UI Parity Checkpoint｜2026-08-23

## 定案
本次 Market 前台／主辦後台／現場／單場工作台，以使用者提供的 `2BL_UI_DESIGN_PACKAGE` 為唯一 UI 與操作基準。

唯一保留 DOING 的部分：
- DOING LINE／會員登入與管理身分
- DOING Core：`tobeloved-api`
- DOING Supabase SSOT
- DOING 角色與租戶權限
- DOING 正式 API／資料表／稽核／重讀閉環

不得搬入：
- 2BL `2bl-v7`
- 2BL Supabase
- 2BL 登入技術

## UI 對應
### 前台
- 16px body
- 色票 `#DDEAD1 / #FAEEC7 / #D9E5EE / #FAE1DD / #DCD7ED`
- 一般卡片 radius 14px；小元件／按鈕 radius 10px
- 活動 cover 140px
- 橫向活動卡最小 160px、縮圖 100px
- 手機底部：首頁／會員／客服
- DOING LINE 登入保留

### 主辦後台
- 背景 `#F8F6F0`
- 主色 `#82ABA3`、次主色 `#628E87`
- body 17px
- 桌機左側固定 150px，內容 left offset 178px
- 手機底部主導覽
- 主導覽固定順序：場次／待辦／現場／會員／活動／財務／寄賣／設定
- 後台按鈕採 2BL 現行 pill 規格；session card radius 22px；reg card radius 20px；stat radius 17px
- 每個場次統計數字是可點入口，進入對應名單

### 現場
- 主工作區 980px
- 報名卡 radius 16px／padding 14px
- 桌機 2 欄名單；手機單欄
- 操作按鈕：手機 2 欄、桌機 4 欄

## 世界樹對應
功能節點不重建、不改名：
- 前台：活動探索 → 會員／登入 → 報名 → 付款 → 排位／設備 → 現場 → 歷史紀錄
- 後台：後台入口 → 場次總覽 → 場次設定 → 待辦 → 審核 → 付款 → 排位 → 退款 → 財務結案
- 閉環：按鈕 → DOING Core／API → Supabase SSOT → 重讀正式資料 → 畫面同步

本次只改 UI／導覽呈現，不新增資料表、不修改 Worker、不修改 2BL。

## 驗收 DoD
- 手機／桌機 Chromium
- 前台分類、活動卡、會員、客服
- 後台 8 主導覽逐一點擊
- 場次每個數字 → 對應單場名單
- 審核／付款／報到／退款／場次設定 API 操作後重讀
- DOING 登入路徑不可被 2BL 登入替換
- 2BL Worker／Supabase 字串不得進 DOING Market runtime
- 實際截圖留存後才可 Release Ready
