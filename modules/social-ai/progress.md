# AI 社群小編 V1｜Atomic Checkpoint

更新：2026-08-18
狀態：IN PROGRESS — NOT RELEASE READY — NOT DEPLOYED

## 已確認
- 獨立工作分支：agent/social-ai-assistant-v1
- main 未修改；目前分支相對 main ahead 2 / behind 0
- 已建立 README.md 與 schema.sql
- Supabase 為唯一正式 SSOT
- Meta 採 OAuth/token，不保存使用者密碼
- AI 產生內容不得直接視為核准
- 未核准內容不得排程或發布

## 尚未通過 DoD
- 可操作 UI
- social-ai API / Worker 串接
- 正式 schema 套用與 DB 實際讀寫驗證
- owner / manager / editor / reviewer 全角色權限 E2E
- FB Page / Instagram Professional Account OAuth 與發布 adapter
- AI 文案／圖片 provider 實際串接
- 發布 queue、idempotency、安全重試實測
- 手機／桌機逐按鈕 click-through
- 完整 regression
- Release Ready

## 執行規則
接續本 checkpoint，不重做已通過項目。每個新增項目完成後更新本檔與修改歷程；任何未實測項目不得標示 PASS。未經使用者最後確認不得部署。
