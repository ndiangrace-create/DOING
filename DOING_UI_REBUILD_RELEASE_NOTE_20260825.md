# DOING UI Clean Slate Release Note｜2026-08-25

本次正式發布只清空 Cloudflare Pages 的舊操作介面，保留 CURRENT 正式短網址與 legacy 301。

正式 Core、Worker、Supabase、121 張資料表與 25 個資料責任模組不變。

Production verification 目標：

- `https://doing.2b-love.com/`
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

每頁應只顯示 DOING 重建殼，不應再載入舊操作 UI。
