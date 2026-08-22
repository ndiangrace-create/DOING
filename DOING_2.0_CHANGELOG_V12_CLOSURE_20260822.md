# DOING 2.0 ChangeLog｜v12 Closure

日期：2026-08-22

- 修正正式申請前後端契約不一致：Worker 既有契約要求 `assistantAnalysis.scope = doing_only`；Web 送出前由 `doing-application-contract-v12.js` 固定對齊。
- 智慧小幫手仍只作客服／導引；`customerServiceOnly=true`、`applicationGate=false`，不再要求使用者完成小幫手確認才能申請。
- 桌機申請頁恢復固定頂部：DOING／我要申請／首頁／我的紀錄；嵌入模式仍維持單層，不重複頁首。
- `doing-candy-theme.css` 升級為全系統共用視覺層，正式 Pages 的申請、會員、Workspace、Market、Project、Booking、Guide、admin、onsite、platform、operations、photo、consignment 統一粉藍／粉紫／嫩綠／奶油黃、方形圓角、立體按壓回饋。
- 首頁 LOGO 改成空白預留位置，由使用者自行放置；搜尋、近期場次、2BL 型場次小卡片與底部三顆純文字按鈕保持。
- Pages build 補齊 v12 契約橋接、共用風格頁與 LOGO slot 資產。
- 自動端對端／回歸：DOING 2.0 Site #74 PASS、DOING Market 2.0 Validation #108 PASS、DOING Safe Production #550 PASS、Cloudflare audit PASS。
- 新資料表 0、Schema 變更 0、2BL 變更 0、正式 Worker 檔案變更 0。
