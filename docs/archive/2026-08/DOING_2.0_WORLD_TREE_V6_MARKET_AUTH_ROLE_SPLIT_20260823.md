# DOING 2.0 世界樹 v6｜Market 身分／權限分流

日期：2026-08-23

本檔為 `doing-world-tree-current.json` 的追加式 auth checkpoint，不覆蓋既有 Market 世界樹。

## 1. 前台報名者路徑｜DONE

正式入口：`/market/public/`

流程：

`活動探索 → 活動 Panel → 報名 → DOING LINE 會員登入 → 回原本 Market 前台 → 會員／我的報名`

固定規則：

- 前台登入者是一般報名者／會員。
- 使用 `doing_member_token`。
- LINE 登入 `return_url` 必須是發起登入的原本 `/market/public/`。
- 登入成功後只把 `member_token` 寫入會員登入暫存，並留在原頁；不可自動跳 DOING 首頁、`/me/` 或 Market 後台。
- 前台可使用會員資料、我的報名、付款／報名進度等會員權限。
- 前台不得交換或取得 `admin_token`。

## 2. 主辦系統申請路徑｜DONE / 權限契約鎖定

正式申請入口：`/apply/`

流程：

`申請營運系統 → DOING LINE 驗證 → 正式申請資料 → 核准／建立營運空間 → 會員中心／工作空間 → 進入 Market 後台`

固定規則：

- 一般會員登入不等於主辦資格。
- 申請者在未核准／未建立正式工作空間前，不得進入 Market 主辦後台。
- 主辦資格由正式工作空間／staff 關聯決定。

## 3. 主辦後台路徑｜DONE

正式入口：`/market/`

流程：

`已核准主辦 → 工作空間 → createMemberWorkspaceAdminSession → 正式 admin_token → /market/`

Core 權限裁決：

- 先驗證 `member_token` 身分。
- 再以 `findStaffForPlatformMember` 查該會員是否有指定 tenant 的 staff／管理權限。
- 沒有 staff 關聯：403。
- 權限停用：403。
- 只有通過上述權限裁決後，才簽發 `admin_token`。
- `/market/` 正式操作只接受 tenant + `admin_token`／正式管理 token。

## 4. 禁止回歸

以下全部視為 P0：

1. 前台 LINE 登入成功後跳回 DOING 首頁。
2. 前台 LINE 登入成功後自動跳 `/me/`。
3. 一般 `doing_member_token` 可直接操作 `/market/`。
4. 一般報名者因完成 LINE 登入而自動取得主辦權限。
5. 未申請／未核准／沒有 staff 關聯的會員可進主辦後台。
6. 主辦後台用前台 member token 直接讀寫正式主辦 API。
7. 前台與後台共用同一個登入回跳目的地。

## 5. SSOT

- Identity：DOING LINE／Google identity（沿用既有機制）。
- 一般會員 token：`doing_member_token`。
- 主辦管理 token：正式 `admin_token`。
- 主辦權限：正式 workspace／staff 關聯。
- 正式資料：DOING Supabase SSOT。
- 本 checkpoint 新增資料表：0。
- 本 checkpoint Worker schema 變更：0。

## 6. 對應驗證

`node scripts/validate-market-auth-role-separation.mjs`

驗證：

- 前台登入回原頁。
- 前台保留會員資料／我的報名。
- 前台沒有 admin session 交換。
- 後台不接受一般 member token 作為權限。
- 主辦 session 交換必須通過 staff／workspace 權限。
