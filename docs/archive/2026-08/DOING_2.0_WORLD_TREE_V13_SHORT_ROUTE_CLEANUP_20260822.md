# DOING 2.0 世界樹 v13｜短網址與層級路由整理

日期：2026-08-22
狀態：Release Ready（尚未合併 main／尚未正式部署）

## 本次邊界

- DOING 公開平台：不重做、不改公開功能。
- DOING 2.0：整理公開網址、頁面層級與回跳。
- Worker／API／Supabase Schema／2BL：0 變更。

## 正式 DOING 2.0 網址

- `/market/`：Market 主系統，內含場次／待辦／現場／會員／設定。
- `/market/public/`：公開活動探索。
- `/market/session/`：Market 單一場次工作頁，從 Market 主系統進入。
- `/project/`：Project 主系統。
- `/booking/`：Booking 主系統。
- `/guide/`：Guide 主系統。
- `/workspace/`：我的 DOING／工作空間層。
- `/me/`：會員／我的紀錄。
- `/apply/`：申請 DOING 2.0。
- `/register/`：正式報名流程。

## 已退役的獨立公開頁

`admin`、`onsite`、`platform`、`operations`、`photo`、`consignment`、`about`、`member` 不再作獨立公開網址；舊根層 `.html` 不進正式 Pages 產物，也不保留 redirect。

歸屬原則：設定與現場回到 Market 內部分頁；平台與營運空間回到 Workspace；會員紀錄固定 `/me/`；申請固定 `/apply/`。

## 閉環

- `/me/ → LINE → /me/`，不繞首頁。
- `/apply/ → LINE → 自動開通 → /me/ → /workspace/ → 對應產品`。
- Market：主系統內完成場次／待辦／現場／會員／設定；單場才使用 `/market/session/`。
- 建置硬性阻擋舊 `.html` 公開頁、舊頁引用與多餘獨立路由重新出現。

## 驗證

- DOING 2.0 Site #86：PASS
- DOING Market 2.0 Validation #118：PASS
- DOING Safe Production #564：PASS
- Cloudflare audit：PASS
- productionWrites：0
- Real Browser UAT：尚待正式部署後真人桌機／手機驗收，不偽稱完成。
