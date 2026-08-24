# DOING 2.0 ChangeLog v11｜前台申請流程

日期：2026-08-22

- 智慧小幫手改為客服／導引，不再作為正式申請 gate。
- 正式申請縮短為：選產品 → 選使用類型 → 填資料 → LINE 驗證。
- 移除「固定模組確認」、「查看固定模組」、「這是不是我要申請的系統」等二次確認。
- 前台移除 AI、固定模組、主辦系統、架構規則、Core／SSOT 等內部說明語言。
- Market 不再詢問主辦／攤商角色。
- 後端相容所需 assistantAnalysis / helperUnderstanding 由前端自動提供，不要求使用者操作。
- helperUnderstanding 記錄 customerServiceOnly=true、applicationGate=false。
- 正式資料來源、DB schema、Worker 業務邏輯、2BL 均不變。
- 新資料表 0、Schema 變更 0、正式業務資料搬移 0。
