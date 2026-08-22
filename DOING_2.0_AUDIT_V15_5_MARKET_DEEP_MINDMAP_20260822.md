# DOING 2.0｜Market 心智操作路徑下鑽 Audit Trail

日期：2026-08-22

## 基準

- GitHub main：紅黃綠燈世界樹正式基準。
- 操作參考：使用者提供《2BL 營運世界樹｜心智圖》。
- DOING 資料原則：Supabase 為唯一正式資料來源。

## 本輪實際變更

1. `doing-world-tree-current.json`
   - Market 前台 7 步往下補實際操作節點。
   - Market 後台 7 步往下補實際操作節點。
   - 系統閉環 5 步往下補正式資料分層。
   - 未驗證項目不升級為完成。

2. `world-tree.html`
   - Market 詳細心智圖由單層主節點改為主節點＋向下分支。
   - 保留紅黃綠燈正式顯示相容。
   - 手機仍採左右滑動查看完整圖。

3. `scripts/validate-world-tree-mindmap.mjs`
   - 新增下層節點防退步檢查。
   - 原本前台 7、後台 7、閉環 5 的主線防護保留。

## 未修改

- Market 業務功能頁。
- LINE 登入／申請／自動開通／Workspace。
- Worker。
- Supabase Schema 與正式業務資料。
- 2BL。

## 驗證原則

PR 階段必須跑完網站、Market、全系統安全檢查；若任何一組失敗，不合併、不發布。
