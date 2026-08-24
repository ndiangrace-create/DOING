# DOING Market｜前台報名者 vs 主辦系統登入｜交接

更新時間：2026-08-23 04:01 +08:00

## 0. 接續方式

新對話直接貼：

> 接續 `DOING_MARKET_HANDOFF_AUTH_ROLE_SPLIT_20260823.md`。不要重做已完成項目，不得把前台報名者登入與主辦系統登入混在一起。先讀正式 main 與本交接，再從未完成／待真人驗證繼續。

---

## 1. 正式基準

Repository：`ndiangrace-create/DOING`

正式主線：`main`

本輪開始時正式 main：`b708418e1fe5c063e659ea3f9752f72bd2ac0157`

該正式版為 PR #159：依 `2BL_INTERACTION_FRAMEWORK_PACKAGE` 完成 Market 前台直接操作；活動卡、會員、客服使用原頁 Panel；DOING Core／Supabase SSOT 不變。

本輪工作分支：`fix/market-auth-role-separation-20260823`

本輪目的：鎖死「一般報名者」與「主辦單位」兩種登入／授權路徑，避免日後再次混用。

---

## 2. 已定案：前台一般報名者

正式入口：`/market/public/`

身分：一般會員／報名者。

登入：DOING LINE。

Token：`doing_member_token`／`member_token`。

正確流程：

`Market 前台 → 會員／我的報名 → LINE 登入 → 驗證成功 → 回原本 Market 前台 → 留在同頁會員 Panel`

必要規則：

- 登入成功後不得跳 DOING 首頁。
- 登入成功後不得自動跳 `/me/`。
- 登入成功後不得進 `/market/` 主辦後台。
- 必須保留原本 tenant／搜尋／分類等前台上下文。
- 前台會員可使用：會員資料、我的報名、報名／付款進度等會員能力。
- 前台登入不得交換 `admin_token`。

目前正式 `market-public.html` 已採：

- `return_url` 使用 `new URL(location.href)`。
- OAuth 回傳的 `member_token` 寫入 `doing_member_token`。
- 使用 `history.replaceState` 清掉網址 token。
- 不再因登入完成自動導向會員中心或首頁。

---

## 3. 已定案：主辦單位

主辦不是「一般會員登入後直接進後台」。

主辦資格流程：

`申請營運系統 → DOING LINE 驗證 → 申請資料 → 核准 → 建立正式 workspace／staff 權限 → 主辦登入 → Market 後台`

正式申請入口：`/apply/`

正式後台入口：`/market/`

主辦後台 Token：正式 `admin_token`。

必要規則：

- 一般 `doing_member_token` 不能直接取得 Market 管理權限。
- 有 DOING 會員身分不代表有主辦資格。
- 沒有核准工作空間／staff 關聯，不得進入 Market 後台。
- 主辦 session 交換必須由 Core 重新確認 workspace／staff 權限。

Core 正式契約：`createMemberWorkspaceAdminSession`

Core 會：

1. 驗證 `member_token` 是有效 DOING 會員。
2. 取得指定 tenant。
3. `findStaffForPlatformMember` 確認該會員真的有該營運空間的 staff 權限。
4. 沒權限回 403。
5. 權限停用回 403。
6. 通過後才 `issueAdminToken`。

因此：

`member_token ≠ admin_token`

這是永久規則。

---

## 4. 目前 Market 後台狀態

`market-center.html` 正式操作讀：

- `tenant`
- `admin_token`／正式管理 token

沒有把 `doing_member_token` 當作主辦 token。

沒有用 `getPlatformMemberProfile` 直接決定主辦權限。

缺 tenant 或 admin token 時不讀正式場次資料，顯示登入 Gate。

---

## 5. 本輪新增防回歸

### 世界樹 checkpoint

`DOING_2.0_WORLD_TREE_V6_MARKET_AUTH_ROLE_SPLIT_20260823.md`

### 驗證器

`node scripts/validate-market-auth-role-separation.mjs`

它會阻擋：

- 前台不再回原頁。
- 前台取得／使用 admin token。
- 後台接受 `doing_member_token` 當主辦權限。
- 後台只靠一般會員 profile 判斷主辦資格。
- Core 不再做 staff／workspace 權限檢查。

### CI

`.github/workflows/doing-market-auth-role-separation.yml`

---

## 6. 與 2BL Interaction Framework 的關係

2BL 包只作為 Market 的互動骨架：

`主導航 → 卡片 → 直接操作；複雜操作才開單一 Panel／Modal`

DOING 保留：

- LINE／Google Identity
- 一般會員 Token
- 主辦 Admin Token
- Core API
- Supabase SSOT
- workspace／staff 權限
- 報名、付款、退款、QR、通知等正式資料

不得搬用 2BL 的登入、Worker、Supabase 或權限資料。

---

## 7. 禁止再犯（P0）

1. 前台報名者 LINE 登入成功跳首頁。
2. 前台報名者 LINE 登入成功跳主辦後台。
3. 一般會員 token 直接解鎖後台。
4. 一般會員因為曾申請但尚未核准就進後台。
5. 把「會員」和「主辦」當成同一角色。
6. 後台登入成功後丟失原 tenant／原工作位置。
7. 新增第二套會員／主辦／權限資料表。

---

## 8. 待真人 UAT

仍需正式網域真人確認：

### 報名者

1. 開 `/market/public/?tenant=<正式租戶>`。
2. 點會員。
3. LINE 登入。
4. 確認回到同一個 Market 前台，而非 DOING 首頁。
5. 確認會員 Panel 顯示會員資料與我的報名。

### 主辦

1. 使用已有正式主辦權限的帳號。
2. 從會員／工作空間進入 Market。
3. 確認 Core 交換成正式 `admin_token` 後進 `/market/`。
4. 使用一般報名者帳號重試，應不得取得主辦後台權限。

---

## 9. DoD

- [x] 前台與後台角色定義分離。
- [x] 一般 member token 與 admin token 分離。
- [x] Core staff／workspace 權限裁決存在。
- [x] 前台正式碼已是登入回原頁模式。
- [x] 世界樹 auth checkpoint 建立。
- [x] 防回歸 validator 建立。
- [x] 專用 CI 建立。
- [ ] 正式網域真人 LINE 前台回跳 UAT。
- [ ] 正式主辦帳號／一般報名者交叉 UAT。

完成上述兩項真人 UAT 後才可把 auth role split 標記為 Production Verified。
