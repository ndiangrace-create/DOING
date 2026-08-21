# DOING Web｜通用預約模組 Release Ready

更新：2026-08-21
分支：`feature/universal-booking-module-20260821`
PR：`#125`
範圍：DOING Web only

## 本次新增

新增 Web 正式操作頁 `booking-center.html`，把既有通用預約 Core 收斂成可操作的一頁式預約中心；沒有建立第二套預約資料。

### 預約中心八段流程

1. 預約工作：讀取／建立既有 `operation_units` 預約型工作。
2. 預約日曆：讀取／建立既有 `booking_calendars`。
3. 服務項目：名稱、價格、分鐘、名額、訂金、前後緩衝、起始間隔。
4. 服務人員／空間／設備：沿用 `resources`，使用通用角色名稱，不寫死產業。
5. 每週固定開放：沿用 `availability_rules`。
6. 臨時加開／休息：沿用 `availability_exceptions`。
7. 可預約空檔預覽：使用 `getAvailableStartsPublic` 正式計算。
8. 今日／近期預約：沿用 `registrations` 與 `service_visits`，處理到店、開始服務、完成服務、未到。

## 正式 SSOT

- 預約工作：`operation_units`
- 服務：`service_items`
- 人員／資源：`resources`
- 日曆：`booking_calendars`
- 每週規則：`availability_rules`
- 單日例外：`availability_exceptions`
- 具體時段：`timeslots`
- 正式預約：`registrations`
- 到店服務狀態：`service_visits`

Supabase 仍是唯一正式營運資料來源。Web 頁面不得用 localStorage 保存正式預約、服務、空檔或顧客資料。

## 沿用既有 API

- `getOperationalCloseout`
- `getOperationUnitsAdmin`
- `saveOperationUnit`
- `getBookingCalendarAdmin`
- `saveBookingCalendar`
- `getAvailabilityAdmin`
- `saveAvailabilityRule`
- `saveAvailabilityException`
- `getAvailableStartsPublic`
- `updateServiceVisit`

本次沒有新增第二套 Worker action。

## Web／App 邊界

本次只修改 `ndiangrace-create/DOING` Web 專案。

- 不修改 `ndiangrace-create/DOING-Market-App`
- 不引用 `doingmarket://`
- 不把 App UI 或原生功能搬進 Web
- Web 與 App 可以使用同一份 Core／Supabase，但前端程式保持分離
- 不碰 2BL／`2bl-v7`

## 手機與桌機

- 主要按鈕最小高度 44px。
- 手機改為單欄，避免寬表格與橫向溢位。
- 桌機兩欄集中管理。
- 小卡使用方形小圓角，不使用圓形功能卡。
- 視覺以既有 Sky／Mint 系統色為主，不使用粉紅作主色。

## 自動驗收

新增：

- `scripts/validate-booking-center.mjs`
- `.github/workflows/booking-center-validation.yml`

驗收項目：

- inline JavaScript 可解析
- DOM id 不重複
- 必要預約 API 契約存在
- 通用服務／資源文案存在
- 手機 breakpoint 與 44px 點擊尺寸存在
- 禁止 Market App／deep-link／2BL 耦合
- `git diff --check`

DOING Safe Production 原有通用預約測試仍需全數通過；任何原有回歸失敗都不得標記 Release Ready。

## 真人 UAT 保留

自動測試不能冒充：

1. 正式租戶以本人身分登入 Web 預約中心。
2. 建立第一個預約工作、服務與日曆。
3. 設定每週開放與臨時例外後重新整理讀回。
4. 顧客真正完成一筆預約。
5. 店家看到同一筆正式預約。
6. 執行顧客到店 → 開始服務 → 完成服務。
7. 真實付款／訂金、改期、取消、退款依各租戶正式規則驗證。

## 發布狀態

目前流程固定停在 PR／Release Ready，不自動合併 `main`，不自動部署 `tobeloved-api`。收到明確發布確認後才進正式發布流程。
