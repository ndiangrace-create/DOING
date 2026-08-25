# DOING Market｜Current ChangeLog

更新：2026-08-25（Asia/Taipei）
範圍：申請頁 tenant slug 收集＋下一階段 Market 路徑／互動交接。

## 本輪 Delta

- `/apply/` 新增「系統帳號／網址代號」必填欄位。
- 格式：英文小寫、數字、`-`，3–40 字；保留字阻擋。
- 即時預覽產品租戶網址：`/market/{tenant-slug}/`、`/project/{tenant-slug}/`、`/booking/{tenant-slug}/`。
- 申請 JSON 保存 `tenantSlug`、`requestedTenantSlug`、`routeContract`；不新增資料表／欄位。
- Route SSOT 鎖定 `tenants.slug` 為租戶網址代號；會員 ID 不進 URL；URL 不具授權效果。
- Market 定位鎖定：`/market/{tenant-slug}/` 為租戶公開市集／活動首頁；隱藏租戶入口只發起身分確認。
- 2BL Interaction Framework 已整理為 DOING Market UX／流程參考；禁止修改或連用 2BL 資料來源。
- 下一階段先做 Role × State Matrix、Task Flow、Navigation Contract、手機＋桌機 Click-through Prototype、Reverse Brainstorming，停 Decision Gate。

## 驗證

- DOING Kawaii Home PR workflow：PASS。
- Chromium application/login/home E2E：PASS。
- 390×844、1440×1000：PASS，無水平溢出。
- tenant system account 欄位：PASS。
- reserved slug 阻擋：PASS。
- application payload tenantSlug／routeContract：PASS。
- DOING Market Auth Role Separation：PASS。
- Worker change：0。
- Supabase schema/business-data change：0。
- 2BL change：0。
- production deploy：0（skipped）。

## 尚未完成／不得誤稱完成

- `requestedTenantSlug` 正式 provisioning → `tenants.slug` 尚未串接。
- `/market/{tenant-slug}/` 等動態租戶路由尚未正式發布。
- Market 租戶公開首頁＋操作模式尚未製作。
- 上述項目必須先通過下一階段 Decision Gate。
