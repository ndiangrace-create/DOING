# DOING 2.0 世界樹 v9｜申請 → 主辦登入 → 工作空間 → Market

> 本檔新增 v9 流程定案；v1～v8 歷史版本不得覆寫。

## 1. 正常使用順序

DOING 2.0 的主辦使用者不需要先擁有「主辦帳號」才能申請。

固定流程：

1. 未登入使用者進入正式智慧申請。
2. 先選工作類型與角色，確認 DOING 對工作的理解。
3. 最後填正式申請資料：營運單位／品牌、姓名、電話、Email、所在地區、至少一個公開品牌／社群／官網／作品網址。
4. 按「使用 LINE 驗證並送出」。
5. `createOrganizerApplicationDraft` 將申請寫入既有 `tenant_apply_logs`。
6. LINE OAuth 使用 `mode=organizer_signup` 驗證本人。
7. 驗證完成後申請狀態轉 `pending`，由既有正式 DB trigger `doing_auto_activate_workspace_after_verification` 處理。
8. 一般正常申請自動建立／連結既有正式資料根：`tenants`、`tenant_settings`、`staff`（`organizer_owner`）。
9. 成功後 `tenant_apply_logs` 轉 `approved` 並寫入 `tenant_id`；只有身分衝突或資料異常才轉 `manual_review`。
10. Web 自動完成會員 session 接續，不要求使用者再找第二個登入按鈕。
11. 進入「我的 DOING」→「我的營運」／工作空間。
12. 工作空間中的「市集」正式進入 `/market/`，沿用 DOING Market 2.0。

## 2. 登入規則

- 公開會員／主辦本人以 LINE 為優先登入。
- 「我的 DOING」只允許一條登入鏈；內容區不得再出現第二顆重複 LINE 登入按鈕。
- 未登入直接進 LINE OAuth，成功後回到原 `member-panel` 分頁，不得先繞首頁。
- `staff_invite`、`registration_invite` 必須保留至登入完成。
- 已有 30 天會員 token 時直接載入，不重複登入。
- 主辦身分來源必須是正式 `staff.platform_member_id` 關聯；前端不得自行猜測 owner。

## 3. 申請完成後的相容接續

目前正式 Worker 的 `organizer_signup` 成功路徑會完成申請與工作空間建立，但正常成功回跳未直接帶 `member_token`。

DOING 2.0 Web 暫以 `doing-application-completion.js` 作相容接續 Bridge：

- 若已有 member token，直接進「我的 DOING」。
- 若沒有，系統自動啟動一次 member LINE session 交換，return_url 固定回 `member-panel#operations`。
- 使用者不需要再人工尋找第二個登入入口。
- 未來若 Core 直接於 organizer_signup 安全簽發 member token，可移除此 Bridge；在 Core 契約正式變更前不得自行刪除。

## 4. Market 路由

- Hub 本階段不改。
- `workspace.html` 的 Market 工作入口必須保留 tenant + admin_token 並進 `/market/`。
- 不得再把 Market 主入口導回舊 `admin.html#sessions`。
- Market 內部正式資料與操作仍沿用既有 DOING Core/API/Supabase，不建立第二套資料。

## 5. SSOT 與安全邊界

- Supabase `DOING_SaaS` 為唯一正式業務資料來源。
- 本次新增資料表：0。
- Schema 變更：0。
- Worker 正式邏輯變更：0。
- 2BL 變更：0。
- Market App 變更：0。
- 不修改既有計費、付款或退款規則。

## 6. 正式資料庫驗證證據

2026-08-22 read-only 驗證已確認最新 `approved` 申請符合以下關聯：

- application status = `approved`
- tenant 存在且 active
- tenant `config_json.sourceApplicationId` 與原申請一致
- `tenant_settings` 存在
- `staff` owner 存在、role = `organizer_owner`、active = true
- owner `platform_member_id` 與申請 `memberId` 一致
- application timeline 包含 `workspace_auto_activated`

因此正式資料層的「申請 → 工作空間 → 主辦 owner」閉環存在；本次需修正的是 Web 部署檔案與登入／操作接續順序。

## 7. DoD

只有下列全部通過才可進 Release Ready：

- 正式申請頁與依賴檔均存在於 doing-2 Pages 產物。
- 會員中心單一登入 return_url 回原分頁。
- approved 後可自動接續會員 session。
- 我的 DOING 可看到正式 workspaces。
- workspace Market 入口導向 `/market/`。
- Market v8 回歸不受影響。
- Safe Production、DOING 2.0 Site、Market Validation 全綠。
- DB read-only 關聯驗證全通過。
- v1～v8 不覆寫，ChangeLog 僅追加。
