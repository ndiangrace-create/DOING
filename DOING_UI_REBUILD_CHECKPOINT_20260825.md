# DOING UI Clean Slate Checkpoint｜2026-08-25

## 目的

正式網站操作層進入全量重建。舊操作 UI 不再發布，只保留正式網址與舊網址相容導向。

## 保留的正式網址

- `/`
- `/market/`
- `/market/public/`
- `/market/session/`
- `/project/`
- `/booking/`
- `/guide/`
- `/workspace/`
- `/me/`
- `/apply/`
- `/register/`
- `/world-tree/`

## 發布狀態

每一條正式網址目前只發布 `rebuild-shell`：

- 無舊操作按鈕
- 無表單
- 無前端 API 呼叫
- 無 Supabase 直連
- 無 localStorage / sessionStorage 業務邏輯
- no-store
- noindex / nofollow / noarchive

舊長網址只做 301 到 CURRENT 短網址。

## 永久保留且本階段不修改

- `worker.js / worker.txt`
- Cloudflare Worker `tobeloved-api`
- Supabase `DOING_SaaS / nayonqbzejoojexxxkyg / public`
- 121 張 live public tables
- 25 個 CURRENT 資料責任模組
- Core Contract
- DB SSOT / Module Registry / Operation Path Tree
- Git 歷史與 rollback 基準
- 2BL 完全隔離

## 刪除的意義

本 checkpoint 的「刪除舊操作版」是**從正式 Pages 發布產物移除所有舊操作 UI**。
舊 source 暫留 Git 版本歷史／repo 作 rollback 證據，但 build 不再讀取，也不會發布到正式網站。
重建完成後，再依 CURRENT 模組樹逐頁建立新的操作面；不得複製舊 UI 疊層回來。

## 安全邊界

- Database changes: 0
- Schema changes: 0
- Worker changes: 0
- API changes: 0
- 2BL changes: 0
- 正式 Pages deployment：本次有明確授權，合併 main 後由 `doing-2-site.yml` 自動部署。
