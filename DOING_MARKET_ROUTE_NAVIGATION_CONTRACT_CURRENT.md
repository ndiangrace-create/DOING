# DOING Market｜Route & Navigation Contract CURRENT

更新：2026-08-25（Asia/Taipei）
狀態：Decision Gate 已確認；動態租戶路由尚未正式實作／部署。

## 1. 固定路由模型

DOING 對租戶公開與操作網址統一採：

`產品前綴 / tenant slug / 工作內容`

- Market：`/market/{tenant-slug}/`
- Project：`/project/{tenant-slug}/`
- Booking：`/booking/{tenant-slug}/`

`tenant-slug` 必須沿用既有 `tenants.slug`。不得另建 public_tenant_id、market_id、account_id 等第二套同義欄位。

## 2. 身分、租戶、產品三者分離

- LINE／DOING member：回答「這個人是誰」。
- tenant slug：回答「現在是哪一個租戶」。
- product prefix：回答「現在使用哪一套系統」。
- staff／owner／admin session：回答「這個人能不能操作這個 tenant」。

會員 ID 不放在 URL。URL 不具授權效果；手動輸入 `/market/{slug}/` 只能定位公開租戶頁，不能取得後台權限。

## 3. 申請頁契約

`/apply/?system=market|project|booking`

新增欄位：`系統帳號／網址代號`。

格式：英文小寫、數字、`-`，3–40 字，不得使用 DOING 保留字。

申請 payload 保存：

- `tenantSlug`
- `requestedTenantSlug`
- `routeContract.product`
- `routeContract.tenantSlug`
- `routeContract.publicPath`

申請資料仍寫入既有 application JSON；不新增資料表、不建立第二套租戶資料來源。

注意：本次只完成「申請收集＋路由契約」。正式 provisioning 將 requested slug 綁定到 `tenants.slug`、slug 衝突處理及動態路由解析，列為下一階段正式實作項目；Decision Gate 前不得自行改 DB 架構。

## 4. DOING Market 公開頁定位

`/market/{tenant-slug}/` = 該租戶對外公開的 Market 首頁。

公開對象：攤商、參加者、一般民眾。

主要流程：

`租戶 Market 首頁 → 活動／場次 → 報名 → 我的報名`

公開頁提供隱藏租戶入口。隱藏手勢只發起身分確認，不授權；必須經正式 member → tenant staff／owner 驗證後才能進操作模式。

## 5. 租戶操作模式

租戶操作 UI 參考 2BL 固定 Level 1：

`場次｜待辦｜現場｜會員｜活動｜財務｜寄賣｜設定`

不另開「主辦首頁」或 `/market-dashboard/`。

同一 `/market/{tenant-slug}/` 依正式權限切換公開狀態與租戶操作狀態；複雜單場工作再進單場 context。

## 6. Navigation Contract 最低欄位

每一個正式按鈕在實作前都必須定義：

1. 顯示條件
2. 按鈕名稱
3. 所在位置
4. 點擊動作
5. 使用資料
6. API／正式 function
7. 成功結果
8. 失敗結果
9. 下一步
10. 返回位置

同一功能若有多入口，必須連到同一正式 function／API／Worker；不得複製第二套操作邏輯。

## 7. 安全與返回規則

- URL slug 只定位 tenant，不授權。
- member token 不等於 admin token。
- 沒有該 tenant staff／owner 權限時，隱藏入口必須拒絕操作並留在公開頁。
- 任何操作完成後 reload 正式資料並留在原工作上下文。
- 危險操作必須二次確認並說明實際影響。
- 手機與桌機只改排列／資訊密度，不增加操作層級。

## 8. 下一階段

新對話先執行：

`Role × State Matrix → Task Flow → Navigation Contract → Click-through Prototype → Reverse Brainstorming → Decision Gate`

確認後才串正式 Core／API／Supabase，並執行所有角色與狀態的 Real-Browser E2E、Regression、Fix Until DoD。
