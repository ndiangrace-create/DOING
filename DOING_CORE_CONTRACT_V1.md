# DOING Core Contract v1

更新：2026-08-21  
正式 Core：`tobeloved-api`  
正式資料：DOING Supabase `public` schema

本契約只新增 DOING Core 能力。Web 既有 LINE 登入、會員、報名、現場報到與通知接口維持相容；不建立 Market App 的第二套會員、報名或計費資料。

## 1. LINE 原生 App 登入

### 開始登入

`GET /auth/line/start?mode=market_app&code_challenge={S256}&device_id={installationId}&app_state={state}`

- App 先在裝置產生 43–128 字元的 `code_verifier`，只保存在裝置記憶體；傳送其 SHA-256 Base64URL 值作為 `code_challenge`。
- `device_id` 是 App 安裝識別，不是會員憑證。
- LINE 完成本人驗證後固定回跳 `doingmarket://auth/line?code=...&state=...`。
- 回跳網址只有五分鐘、一次性 `code`，絕不包含 `member_token`。

### 交換會員 Token

`POST /` action：`exchangeMarketAppAuthCode`

請求：`code`、`code_verifier`、`device_id`。成功後才在 HTTPS response body 回傳 `member_token`；同一交換碼重送、逾時、裝置或 verifier 不符都拒絕。

資料：`platform_members`、`platform_member_identities`、`mobile_auth_exchanges`。交換表只保存交換碼雜湊，不保存 `member_token`。

## 2. 攤商活動日個人 QR 報到

### 取得個人 QR

`POST /` action：`getMarketVendorQr`

請求：`member_token`、`registrationId`。只有該報名本人或 `registration_members` 中仍為 active 且有 checkin 權限的實際出攤者可取得。QR 是兩分鐘短效簽章，不含姓名、電話或 Email。

### 工作人員掃碼

`POST /` action：`scanMarketVendorQr`

請求：`qr_token`、工作人員 `email` 與既有 `token`。Core 會同時檢查：QR 簽章與期限、報名與場次未變、出攤者授權仍有效、工作人員具該租戶與場次 checkin 權限、報名已錄取且已完成必要付款。成功後更新同一筆 `registrations`，並寫入 `seat_operation_logs`。重複掃描已報到資料會安全回傳已完成，不重複寫入。

## 3. iOS／Android Push

### 登錄與撤銷裝置

- `registerMarketPushToken`：會員 Token、`installation_id`、`platform`（ios／android）、`provider`（apns／fcm）、`push_token`。
- `unregisterMarketPushToken`：會員 Token、`installation_id`；撤銷時立即停用並清除可投遞 Token。
- iOS 支援 APNs 或 FCM；Android 支援 FCM。
- 會員只能管理自己的裝置，Token 不會出現在清單、稽核或通知 payload。

### 建立通知與投遞

`queueMarketPushNotification` 只允許該租戶／場次具有 announce 權限的工作人員，且目標必須是同一筆正式報名。通知寫入既有 `notifications`，每台有效裝置的狀態寫入 `mobile_push_deliveries`。

Core 排程只在正式設定 `MOBILE_PUSH_GATEWAY_URL` 與 `MOBILE_PUSH_GATEWAY_TOKEN` 後送出；未設定時保留 queued，不會假稱已送達。失敗採漸進重試，最多五次後標為 failed。

## 權限與資料邊界

- 三張新增表全部啟用 RLS，撤銷 `public`、`anon`、`authenticated` 直接權限，只允許 `tobeloved-api` 的 service role。
- 正式會員仍是 `platform_members`，正式報名仍是 `registrations`，正式通知仍是 `notifications`。
- QR、交換碼與裝置 Token 不進前端 localStorage，也不記入一般操作 log。
- 本次不修改計費，不觸碰 2BL。

## 驗收狀態

自動驗收固定檢查 API 路由、安全交換、一次性消耗、短效 QR、跨租戶與現場權限、Push 裝置所有權、RLS、Worker 雙檔同步與既有全系統回歸；`productionWrites = 0`。

仍待真人／真機：LINE 原生 App 回跳、iOS／Android 實機登入、相機掃碼、APNs／FCM 正式憑證與實際收訊。這些不得由程式測試冒充通過。
