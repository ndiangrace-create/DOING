# DOING v11｜首頁改版固定規格＋部署執行單

日期：2026-08-22
狀態：Implementation → E2E → Release Ready → Authorized Deploy

## 一、首頁使用者定位

DOING 2.0 根首頁是一般民眾入口，不是工程／後台說明頁。

首頁只回答三件事：
1. 我要找活動／課程／體驗。
2. 我要看自己的紀錄。
3. 我需要線上客服。

營運方申請保留為次要入口「我要申請 DOING」，不與一般民眾主操作搶焦點。

## 二、視覺固定規格

參考使用者提供的手機視覺：柔和水彩糖果色、粉藍／粉紫／嫩綠／奶油黃、方形大圓角。

- 主色：粉藍、粉紫、嫩綠、奶油黃；粉色可用於首頁視覺但不延伸成後台主色。
- 主按鈕：方形大圓角、立體厚度、高光、底部陰影。
- 按下狀態：按鈕下沉，陰影縮短，提供實體按壓回饋。
- 一般文字至少 17px；主操作 20px 以上。
- 手機版與桌機版分別響應，不把桌機框硬縮成手機。
- 不裁字、不破圖、不橫向溢位。

## 三、首頁固定操作

### 搜尋
首頁搜尋框 → `/market/public/?q=<關鍵字>` → 公開活動頁自動帶入搜尋。

### 報名活動
「報名活動」→ `/market/public/`。

### 我的紀錄
「我的紀錄」→ `/member-panel.html#activities`。
未登入時沿用既有單一 LINE 登入，成功回原會員分頁。

### 線上客服
「線上客服」→ 首頁內 DOING 客服對話框。
客服沿用既有 `analyzeDoingApplication` 的 question 模式及正式知識／安全規則。
客服不得成為申請 gate，不得要求先完成對話才能申請。

### 我要申請 DOING
→ `/smart-application.html`
固定流程：選產品 → 選使用類型 → 填資料 → LINE 驗證 → 建立工作空間。

## 四、安全邊界

- 不修改 2BL。
- 不建立新資料表。
- 不改正式 Schema。
- 不改 `tobeloved-api` 業務邏輯。
- Supabase 繼續是 SSOT。
- 首頁改版不得改壞 Market、會員、Booking、Project、Guide 既有路由。

## 五、端對端驗收矩陣

1. 根首頁可載入。
2. 搜尋可攜帶 query 到公開活動頁。
3. 報名活動入口正確。
4. 我的紀錄入口正確。
5. 未登入會員中心仍走單一 LINE OAuth 並回原分頁。
6. 線上客服可開／關、快捷問題、Enter 送出、AI 問答 API 路徑存在。
7. 我要申請不再受智慧小幫手 gate 阻擋。
8. 申請 LINE → 自動開通 → 我的 DOING → workspace → Market 契約回歸。
9. Market 桌機／手機操作骨架不受首頁 CSS 汙染。
10. 所有正式資料來源維持 Supabase SSOT。
11. Safe Production／Cloudflare audit／DOING 2.0 Site 全綠。
12. 合併 main 後由 Cloudflare Pages 發布 `doing.2b-love.com`。

## 六、DoD

- 前台無工程語言。
- 首頁三個主按鈕可操作。
- 立體按鈕按壓回饋存在。
- 手機／桌機不破框、不裁字。
- 申請不再被客服／小幫手阻擋。
- 全自動回歸 PASS。
- 正式發布後再做真人瀏覽器 UAT；自動測試不可冒充真人瀏覽器證據。
