# DOING 2.0 世界樹 v6｜網址與部署架構

日期：2026-08-22
狀態：已定案，等待正式部署／UAT

> 本版本只新增，不覆蓋 v1–v5。

## 正式網址主幹

- `https://doing.2b-love.com/` → DOING 2.0 Hub
- `https://doing.2b-love.com/market/` → DOING Market 主辦營運中心
- `https://doing.2b-love.com/market/public/` → DOING Market 公開找活動／報名入口
- `https://doing.2b-love.com/market/session/` → DOING Market 單場工作台
- `https://doing.2b-love.com/project/` → DOING Project
- `https://doing.2b-love.com/booking/` → DOING Booking
- `https://doing.2b-love.com/guide/` → DOING Guide

## 部署隔離

- `2b-love.com` 舊 2BL 完全不動。
- DOING 2.0 使用獨立 Cloudflare Pages 專案 `doing-2`。
- Cloudflare Pages 建置來源仍是 `ndiangrace-create/DOING`，不建立第二套業務程式或資料庫。
- Pages 根目錄以 `doing-2.html` 作為 `index.html`，因此不需要覆寫現有 DOING `index.html`。
- 不在 Repo 根目錄使用 `CNAME`，避免干擾現有 GitHub Pages。

## 資料與 API

- Web 前端分頁只是產品操作層。
- 所有正式資料仍使用 DOING Core／`tobeloved-api`／DOING_SaaS Supabase。
- 本次新增資料表：0。
- 本次 Schema 變更：0。
- 不複製 Market／Booking／Project／Guide 的同功能資料。

## 路由產物

建置腳本：`scripts/build-doing-2-site.mjs`

輸出：`.doing-2-site/`

- `/index.html` ← `doing-2.html`
- `/market/index.html` → `market-center.html`
- `/market/public/index.html` → `market-public.html`
- `/market/session/index.html` → `market-session.html`
- `/project/index.html` → `project-center.html`
- `/booking/index.html` → `booking-2-center.html`
- `/guide/index.html` → `guide-center.html`

## 發布規則

- PR 階段只建置與驗證，不寫 DNS、不部署 Pages。
- 合併 main 後，`DOING 2.0 Site` workflow 才會：
  1. 建置獨立站。
  2. 建立／確認 Cloudflare Pages `doing-2`。
  3. 部署靜態站。
  4. 綁定 `doing.2b-love.com`。
- 若現有 Cloudflare Token 缺少 Pages／自訂網域寫入權限，部署應失敗並停住，不得改動 2BL。

## UAT

網址生效後必做：
- 桌機：Hub → Market → 五大入口 → 單場七分頁。
- 手機：同路徑逐一點擊。
- LINE 登入／我的報名。
- 主辦正式租戶登入。
- 報名審核／付款確認／現場報到。
- QR 真人情境。
- 所有寫入後確認 Supabase 重讀一致。
