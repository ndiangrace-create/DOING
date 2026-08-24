# DOING 2.0 世界樹 v4｜DOING Market 日常營運版

建立時間：2026-08-22

> v1、v2、v3 全部保留。本檔只記錄在 v3 基礎上已完成的 Market 日常操作內聚，不覆蓋前版。

## DOING Market 主頁

### 場次
- ✅ `getSessionsAdmin` 直接讀正式場次
- ✅ 場次卡直接進 `market-session.html`
- ✅ 保留進階管理回既有 admin

### 待辦
- ✅ `getTodos` 直接讀正式跨場次待辦
- ✅ 審核／補件、付款、退款／保證金、其他待辦分類顯示
- ✅ 有 sessionId 的待辦直接進 Market 單場工作台
- ✅ 無法對應單場時安全回既有 todos
- 禁止前端自行推算正式待辦狀態

### 現場
- ✅ 選場次
- ✅ 當日名單／該場次全名單
- ✅ 搜尋姓名／品牌／電話
- ✅ `getSessionRegistrations`
- ✅ `checkin` 一鍵報到
- ✅ 寫入後重新讀正式名單
- ✅ QR 完整能力保留；目前不強迫夥伴切換

### 會員／品牌
- ✅ `getMembers` 直接讀正式會員／品牌資料
- ✅ 搜尋品牌／姓名／手機／Email／FB／IG
- ✅ 完整歷史紀錄仍安全回既有 members 能力

### 設定
- ✅ 付款資訊
- ✅ 合約
- ✅ 通知模板
- ✅ 工作人員／權限
- ✅ 首頁／品牌
- ✅ 現場設定
- 🔵 第一階段維持既有正式 settings 實作，不複製設定資料

## Market 單場工作台
固定：總覽／報名審核／付款／排位設備／通知／現場／結案。

### 已內聚
- ✅ 正式場次總覽 `getSessionDashboard`
- ✅ 正式報名名單 `getSessionRegistrations`
- ✅ 錄取／候補／不錄取 `approveReg`
- ✅ 主辦確認付款 `confirmPayment`
- ✅ 一鍵報到 `checkin`
- ✅ 每次寫入後重新讀 SSOT

### 暫時沿用成熟能力
- 排位設備 → 既有 admin seat/equipment
- 通知 → 既有 settings/email/notification
- 退款／保證金 → 既有 finance/onsite
- 財務結案 → 既有 finance

## 資料規則
- 新資料表：0
- Schema 變更：0
- 正式資料搬移：0
- `sessions`、`registrations`、`payments`、會員／品牌與現場既有資料根不改名、不複製。

## 下一個 Market 開發區塊
1. 單場付款提醒直接操作
2. 場次新增／複製原生化
3. 退款／保證金原生化
4. 排位設備原生化
5. 通知原生化
6. 結案原生化
7. 市集前台／報名端收斂
8. 手機＋桌機真人 UAT
