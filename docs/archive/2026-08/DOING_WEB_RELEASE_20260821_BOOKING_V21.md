# DOING Web｜2026-08-21 通用預約正式發布

發布來源：PR #125
發布基準：`49bf829e667dce9f05426bf06fa5f17ad15b7bc9`
範圍：DOING Web only

本版本將通用預約中心正式納入 DOING Web，並保留 2026-08-21 最新 `main` 的營運申請自動開通、90 天安全清理與既有正式營運修復。

正式內容：
- `booking-center.html` 通用預約中心
- 完整營運中心 → 預約中心正式入口
- 預約工作、服務項目、服務人員／空間／設備
- 預約日曆、每週固定開放、臨時加開／休息
- 可預約空檔計算
- 正式預約的到店／開始服務／完成／未到流程
- Supabase SSOT 與既有 `registrations`、`operation_units`、`service_items`、`resources`、`booking_calendars`、`availability_rules`、`availability_exceptions`、`service_visits`

發布規則：本檔提交至 `main` 用於觸發 `DOING Safe Production`。只有完整驗證通過後才允許部署固定 Worker `tobeloved-api`；禁止部署 `2bl-v7`。

Web 與 `DOING-Market-App` 前端持續分離。本次不修改手機 App、不修改 2BL、不修改計費。
