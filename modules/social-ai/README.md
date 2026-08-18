# AI 社群小編 V1

狀態：獨立模組開發中，不掛入 DOING 正式租戶，不部署。

## 目標
讓管理多品牌、多活動的使用者，以最少操作完成「企劃 → 產文 → 配圖 → 審核 → 排程 → 發布 → 紀錄」。

## V1 功能
- 多品牌管理
- 品牌成員與權限（owner / manager / editor / reviewer）
- 宣傳任務／活動建立
- 一次產生多篇不同切角貼文
- 每篇保存圖片生成 Prompt
- AI 圖片 provider adapter（未設定 provider 時仍可複製 Prompt 使用）
- 使用者自行上傳／替換圖片
- 草稿、待審、核准、排程、發布、失敗狀態
- 月曆排程
- FB Page / Instagram Professional Account 連線資料模型
- 僅「已核准」內容可進發布佇列
- 發布結果、失敗原因、重試次數、稽核紀錄
- 預留 tenant_id / brand_id，未來可掛回 DOING

## 安全原則
- 不保存 Facebook / Instagram 使用者密碼。
- 社群平台採官方 OAuth / token 授權。
- token 僅能存在伺服器端 secret / 加密儲存，不可送到前端或 localStorage。
- AI 產生不等於核准；發布前必須有人為核准 checkpoint。
- Supabase 為正式 SSOT；瀏覽器不可成為正式資料來源。

## 模組邊界
目前不依賴 DOING 尚未完成的租戶 UI。之後整合時，只由宿主傳入 tenant_id、brand_id 與授權身分；社群小編核心維持獨立。

## DoD
1. 品牌 A 成員不可讀寫品牌 B。
2. editor 可產生／修改草稿，但不可越權發布。
3. reviewer/owner 可核准。
4. 未核准貼文不可排程或發布。
5. 每篇貼文可保存文案、平台版本、圖片 Prompt、圖片資產與排程時間。
6. 發布失敗保留錯誤並可安全重試，不能重複發文。
7. 手機與桌機可完成完整流程。
8. 所有關鍵修改均有 audit log。
9. Meta / AI provider 尚未授權時，核心內容工作流仍可正常使用。
10. 完成 E2E、權限測試與 regression 後才可標記 Release Ready。
