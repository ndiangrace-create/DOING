# DOING UI Rebuild Audit｜2026-08-25

## Scope

正式 Pages 操作層清空，保留 CURRENT 短網址與 legacy 301，相同 Core／API／Supabase 全部保留。

## Atomic checkpoint

- 工作分支：`rebuild/doing-clean-slate-20260825`
- 只改 Pages build / Pages CI / route SSOT / checkpoint documents
- `worker.js`：未修改
- `worker.txt`：未修改
- Supabase：未修改
- Schema：未修改
- 正式資料：未修改
- 2BL：未修改

## 驗收條件

部署產物必須：

1. 僅存在 12 個 CURRENT HTML route shell。
2. 所有 shell 包含 `data-doing-ui-state="rebuild-shell"`。
3. 不包含 `<script`、`<form`、`<button`。
4. 不包含 Core API URL、Supabase URL、localStorage/sessionStorage 業務邏輯。
5. 舊長網址只允許 301 到 CURRENT 短網址。
6. Cloudflare Pages 專案固定 `doing-2`，正式網域固定 `doing.2b-love.com`。
7. `2bl-v7` 不得出現在部署產物。

## 發布授權

使用者已明確要求正式部署，合併 main 後由 `DOING Route Shell Site` workflow 部署 Cloudflare Pages。
