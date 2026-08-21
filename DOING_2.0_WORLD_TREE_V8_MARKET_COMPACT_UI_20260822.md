# DOING 2.0 世界樹 v8｜Market 2BL 緊縮營運介面

日期：2026-08-22
狀態：實作驗證中，未發布

> 本版本只新增，不覆蓋 v1–v7。Hub 本輪不修改。

## 本輪目的

依使用者實際畫面回饋，修正 DOING Market 因「Hub 共用導覽＋Market 自有導覽＋底部導覽」重疊造成的版面混亂。

## UX 基準

以目前已穩定使用的 2BL 後台操作骨架為 Market 介面基準，但不搬 2BL 資料庫、Worker 或業務邏輯。

### 主導覽

- 場次
- 待辦
- 現場
- 會員
- 設定

### 桌機

- 左側固定主導覽。
- 右側為寬工作區。
- 場次小卡多欄排列，降低大片空白。
- 統計數字維持可快速掃讀。

### 手機

- 五大主導覽固定底部。
- 單欄場次卡。
- KPI 同卡內緊縮排列。
- 不以桌機版直接縮小。

## 視覺

- 基礎字級 17px，兼顧老花友善。
- 主要操作高度至少 40px；手機主導航至少 46px。
- 小卡片、小圓角、高資訊密度。
- 淡藍／薄荷綠／奶油黃／冰藍作為輔助色。
- 禁止漸層。
- 粉紅不作主色。

## 範圍鎖定

本輪只影響：
- `market-center.html` 部署成品
- `market-session.html` 部署成品
- `doing-market-2bl.css`
- `scripts/build-doing-2-site.mjs`

本輪不修改：
- DOING 2.0 Hub 首頁邏輯與畫面
- Project／Booking／Guide
- `tobeloved-api`
- Supabase Schema／正式業務資料
- 2BL Repo／Worker／資料庫

## 資料閉環

Market 既有按鈕與正式流程仍維持：

畫面 → DOING API → Supabase SSOT → 重讀 → 畫面

本輪新增資料表：0
Schema 變更：0
正式資料搬移：0
