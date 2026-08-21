# DOING Market 2.0｜Release Candidate Checkpoint

日期：2026-08-22
分支：`feature/doing-market-2.0-20260822`
PR：#129
狀態：Release Candidate；未合併、未部署。

## 本版範圍

### 公開端
- `market-public.html`
- 讀取既有 `publicDiscovery`
- 市集／活動／體驗／DIY 分類與搜尋
- 活動詳情與報名回既有正式 `index.html?tenant=...&session=...`
- 我的報名沿用既有 LINE member OAuth 與 `member-panel.html#activities`

### 主辦端
- `market-center.html`
- 固定：場次 → 待辦 → 現場 → 會員 → 設定
- 正式資料：`getSessionsAdmin`／`getTodos`／`getMembers`／`getSessionRegistrations`
- 現場一鍵報到：`checkin`

### 單場工作台
- `market-session.html`
- 固定：總覽／報名審核／付款／排位設備／通知／現場／結案
- 正式讀取：`getSessionDashboard`／`getSessionRegistrations`
- 正式寫入：`approveReg`／`confirmPayment`／`checkin`
- 寫入完成後重新讀取 SSOT

### 過渡策略
- 付款流程沿用 2BL 習慣。
- 現場保留姓名／品牌搜尋＋一鍵報到；QR Core 完整保留但不強迫第一天使用。
- 排位設備、通知、退款／保證金、完整財務與結案等成熟能力先安全連回既有正式 admin；不得複製資料。

## 世界樹與歷史
- v1：不可覆蓋 Baseline
- v2：產品拆分
- v3：Market 執行
- v4：Market 日常營運
- v5：Market 公開前台
- ChangeLog：只追加

## 資料安全
- 新資料表：0
- Schema 變更：0
- 正式資料搬移：0
- 2BL 修改：0
- DOING Market App 修改：0
- 舊 DOING 功能刪除：0
- Supabase DOING_SaaS 繼續為唯一正式資料來源

## 自動驗證
最近全綠 checkpoint：
- DOING Market 2.0 Validation #34：PASS
- DOING Safe Production #459：validate PASS
- Cloudflare audit：PASS
- deploy：skipped（PR 尚未發布）
- productionWrites=0

公開前台追加後：
- DOING Market Validation #33：PASS
- Safe Production #458 僅因測試 sourceFingerprint 更新而阻擋，其餘步驟皆 PASS。
- sourceFingerprint 已更新為 `ff7b56b400b54daf3578c9acd0619be95643029fda6eed7747a7bb159caa2ebb`，需以最新 head 再跑一次完整 CI 才可將本 Checkpoint 升級為 Release Ready。

## 尚未宣稱 PASS
- 正式 LINE 登入真人操作
- 正式租戶真實場次操作
- 手機真機 click-through
- 桌機真瀏覽器 click-through
- 正式付款真人情境
- 正式 QR 真人情境
- 正式部署後 publicDiscovery／報名回跳

## DoD 到 Release Ready 的最後門檻
1. 最新 head Market Validation 全綠。
2. 最新 head Safe Production validate + Cloudflare audit 全綠。
3. PR 保持可合併且無新阻斷。
4. 不新增資料表。
5. 合併／部署仍等待使用者確認。
