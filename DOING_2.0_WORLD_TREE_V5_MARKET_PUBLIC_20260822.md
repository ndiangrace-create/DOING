# DOING 2.0 世界樹 v5｜DOING Market 前台版

建立時間：2026-08-22

> v1-v4 保留。本檔只追加 Market 公開端收斂，不覆蓋任何前版。

## DOING Market 公開入口

### `market-public.html`

使用者路徑：
1. 找市集／活動／體驗
2. 搜尋活動名稱／主辦／地點
3. 分類：市集／活動／體驗／DIY
4. 查看近期開放活動
5. 點活動 → 回到既有正式 `index.html?tenant=...&session=...`
6. 沿用既有正式報名／合約／付款／我的報名流程

### 正式資料來源
- ✅ `publicDiscovery`
- ✅ 不建立第二套公開活動資料
- ✅ 不複製 sessions／registrations
- ✅ 活動詳情與報名仍使用正式 tenant + session 路由

### 我的報名
- ✅ 沿用既有 LINE member OAuth
- ✅ 已有 member token 時直接進 `member-panel.html#activities`
- ✅ localStorage 僅沿用既有登入 token 暫存，不存正式營運資料

## Market 2.0 前後台分離

### 參加者
`market-public.html` → 正式活動詳情／報名 → 我的報名

### 主辦
`doing-2.html` → `market-center.html` → `market-session.html`

### 共用核心
Core/API/Supabase 完全共用；前後台只是不同操作介面。

## 本版資料影響
- 新資料表：0
- Schema 變更：0
- 正式資料搬移：0
- 2BL 修改：0
- Market App 修改：0

## 下一步
1. 主辦場次新增／複製操作收斂
2. 付款提醒
3. 退款／保證金
4. 排位設備
5. 通知
6. 結案
7. 真人登入／手機／桌機 UAT
