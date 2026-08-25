# DOING Market｜2BL 操作互動參考 CURRENT

來源：使用者提供 `2BL_INTERACTION_FRAMEWORK_PACKAGE(2).zip`。
用途：只作 DOING Market UX／操作層級與流程參考。
禁止：修改 2BL、連用 2BL 資料庫、複製 2BL Worker／API、把 2BL 當 DOING SSOT。

## 核心互動架構

標準：

`主導航 → 工作區 → 卡片 → 直接操作`

複雜操作：

`主導航 → 卡片 → 單一 Panel / Modal → 完成`

禁止：

`主導航 → 子頁 → 子頁 → 子頁 → 才能操作`

手機與桌機只改排列／資訊密度，不得改操作層級。

## DOING Market 租戶操作 Level 1

依 2BL 參考固定為：

`場次｜待辦｜現場｜會員｜活動｜財務｜寄賣｜設定`

這是下一階段 Click-through Prototype 的第一層導航基準，不代表直接照抄 2BL 畫面；視覺使用 DOING CURRENT 規格。

## 卡片是工作單位

每張卡必須回答：

1. 這是誰／哪一場？
2. 現在什麼狀態？
3. 下一步是什麼？
4. 現在能做什麼？

### 場次卡

直接顯示場次名稱、日期、地點、狀態、報名／審核／付款／現場摘要。統計數字可直接進對應名單。

高頻操作直接留卡片：看名單、看待審核、看已付款／未付款、主辦代報名、現場入口、快速統計。

複雜操作才進 Panel：完整場次設定、退款細節、不可抗力、排位設定、財務明細、複雜設備設定。

### 待辦卡

品牌＋場次＋目前階段＋下一步＋直接操作。不得只放「查看」再讓使用者進下一頁找真正按鈕。

### 報名卡

品牌、姓名、Email／手機、日期、攤位、設備、審核、付款、位置、現場狀態。

### 會員卡

品牌、姓名、聯絡方式、FB／IG／官網、歷史摘要；提供資料修改、歷史、主辦代報名。

### 現場卡

選場次 → 選日期 → 報名卡；卡片直接處理報到、撤場、押金、設備、位置。

## 按鈕層級

- Primary：目前最重要的下一步；一個區塊原則上只有一個。
- Secondary：查看、編輯、重新整理、下載、查看紀錄、返回。
- Danger：取消、退款、刪除、退押金、作廢；必須二次確認、說明實際影響、成功後 reload。
- More：低頻功能。

按鈕文案必須結果導向，例如「確認已付款」「設為已報到」「確認退款」「轉為活動金」，避免只有「確認」「處理」「完成」。

## 正式閉環規則

2BL 參考規則：

`Button → Frontend function → API action → Worker handler → Supabase / RPC → response → reload → card update`

套到 DOING 時，必須改成 DOING 既有正式 function／API／Worker／Supabase SSOT；不得複製 2BL function 或資料來源。

同一功能出現在場次卡、待辦卡、會員卡或報名明細時，必須接同一正式 DOING function／API。

## 財務與設定

財務總表保留摘要，單筆細節才進明細 Panel；不得每個財務種類都另開一頁。

設定：`設定 → Tile → Panel／Modal → 儲存 → 回設定`。

## Responsive

桌機增加欄數與資訊密度；手機變單欄／換行。不能因手機版增加新的操作頁或更深導航層級。

## 下一階段驗收方式

先用 Role × State Matrix、Task Flow、Navigation Contract 做手機＋桌機 Click-through Prototype，再用 Reverse Brainstorming 專門找：迷路、斷路、重複操作、回不去、狀態錯誤、權限錯置。使用者 Decision Gate 確認後才串正式功能。
