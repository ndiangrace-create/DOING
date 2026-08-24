# DOING｜功能模組 × Database 模組化 SSOT CURRENT

更新：2026-08-25（Asia/Taipei）

## 0｜核心規則

- 唯一正式資料庫：`DOING_SaaS / nayonqbzejoojexxxkyg / public`。
- Database 模組化是**邏輯責任模組化**，不是拆 schema、拆 DB 或複製資料表。
- 每張 live table 現在都有且只有一個 `primaryOwner`；其他模組只能以 shared dependency 使用。
- UI 改名、路由重做、頁面重建都不得改變正式 table 名稱或另建同義表。
- `doing-capabilities.json` 的舊長網址只保留為歷史證據；CURRENT 路由以正式 build short routes 為準。

## 1｜CURRENT 正式短路由

- `/` → DOING 首頁／入口
- `/market/` → Market 主辦營運中心
- `/market/public/` → Market 公開活動／場次頁
- `/market/session/` → Market 單場工作台
- `/project/` → 專案入口（目前為工程專案殼層，功能 UI 待重建）
- `/booking/` → 預約中心
- `/guide/` → 導覽／Guide 入口
- `/workspace/` → 營運工作空間＋總日曆
- `/me/` → 我的 DOING
- `/apply/` → 正式營運申請
- `/register/` → 正式報名
- `/world-tree/` → 世界樹

## 2｜模組正式名稱與資料責任

| module_key | 正式名稱 | 類型 | primary tables | shared tables | CURRENT 操作面 |
|---|---|---|---|---|---|
| `platform-application` | **租戶申請與開通** | functional | `tenant_apply_logs`、`member_helper_traces`、`doing_helper_knowledge_entries`、`member_helper_conversations`、`member_helper_messages`、`doing_helper_improvement_queue` | `platform_members`、`platform_member_identities`、`tenants`、`tenant_settings`、`staff` | `/apply/`、`/me/#operations`、`/workspace/` |
| `platform-access` | **管理人員與登入備援** | functional | `platform_staff`、`admin_login_logs`、`platform_sessions` | `platform_members`、`platform_member_identities`、`staff`、`staff_session_permissions`、`tenants`、`sessions` | `/workspace/#platform` |
| `platform-tenant` | **租戶與權限管理** | functional | `tenants`、`tenant_settings`、`platform_issue_records`、`platform_risk_cases`、`audit_logs` | `staff`、`staff_session_permissions`、`platform_staff` | `/workspace/#platform` |
| `platform-billing` | **平台收費與創業金** | functional | `billing_entities`、`billing_entity_tenants`、`billing_session_charges`、`billing_monthly_statements`、`billing_payments`、`billing_logs`、`reward_ledger` | `platform_settings` | `/workspace/#platform` |
| `platform-products` | **設定服務與專業模組** | functional | — | `platform_settings`、`tenant_settings`、`billing_logs`、`tenants` | `/workspace/#platform` |
| `platform-exposure` | **首頁曝光推廣** | functional | `exposure_plans`、`exposure_orders`、`platform_attribution_events` | `payments`、`platform_settings` | `/`、`/workspace/#platform` |
| `platform-support` | **平台客服** | functional | `support_threads`、`support_messages`、`doing_public_support_threads`、`doing_public_support_messages` | `notifications` | `/`、`/workspace/#platform` |
| `member-center` | **我的 DOING** | functional | `platform_members`、`platform_member_identities`、`brands`、`brand_members`、`brand_access_requests` | `members`、`registrations`、`registration_members`、`registration_member_invites`、`tenants`、`tenant_apply_logs` | `/me/` |
| `tenant-operations` | **營運項目與場次** | functional | `events`、`sessions`、`operation_units`、`service_items`、`resources`、`timeslots`、`booking_calendars`、`availability_rules`、`availability_exceptions`、`session_bundles`、`service_visits`、`equipment_items`、`short_links` | — | `/workspace/`、`/market/`、`/booking/`、`/project/` |
| `tenant-registration` | **報名、審核與通知** | functional | `registrations`、`registration_items`、`registration_members`、`registration_member_invites`、`notifications`、`email_templates`、`announcements`、`force_majeure_logs`、`tenant_agreement_templates` | `brands`、`brand_members`、`members`、`payments`、`refunds`、`invoices` | `/register/`、`/me/#activities`、`/market/`、`/market/session/` |
| `tenant-finance` | **財務與結案** | functional | `payments`、`refunds`、`finance_items`、`finance_ledger`、`finance_audit_logs`、`invoices`、`payment_allocations`、`transfer_settlements` | — | `/market/#finance`、`/market/session/?tab=closeout` |
| `tenant-people` | **會員與工作人員** | functional | `members`、`staff`、`roles`、`permissions`、`role_permissions`、`staff_session_permissions`、`staff_action_logs`、`tenant_customer_profiles` | — | `/market/#members`、`/market/#settings` |
| `tenant-onsite` | **現場工作台** | functional | `onsite_passcodes` | `registrations`、`registration_members`、`registration_member_invites`、`staff_action_logs`、`audit_logs`、`seat_operation_logs` | `/market/#onsite`、`/market/session/?tab=onsite`、`/me/#activities` |
| `advanced-seat` | **視覺化排位** | functional | `venue_map_templates`、`stalls`、`seat_maps`、`seat_assignments`、`seat_operation_logs` | `registrations` | `/market/session/?tab=seat` |
| `advanced-performance` | **攤商業績與保證金** | functional | `vendor_sales_reports` | `registrations`、`finance_ledger` | `/me/#activities`、`/market/session/?tab=closeout` |
| `advanced-consignment` | **寄賣與 POS** | functional | `consignment_periods`、`consignment_applications`、`consignment_products`、`pos_sales`、`pos_sale_items`、`inventory_movements` | `registration_items`、`finance_ledger` | `/market/#consignment`、`/market/#settings` |
| `advanced-photo` | **拍照框活動** | functional | `photo_activities`、`photo_activity_frames`、`photo_leads` | — | `/market/#settings` |
| `tenant-themes` | **租戶五套視覺模板** | functional | — | `tenant_settings` | `/market/#settings`、`/market/public/` |
| `platform-visual` | **DOING 平台視覺基準** | governance | — | `platform_settings` | `/`、`/me/`、`/apply/`、`/workspace/`、`/booking/`、`/project/`、`/market/` |
| `platform-map` | **DOING 營運世界樹** | governance | `platform_change_ledger`、`platform_feature_versions`、`platform_dependency_versions`、`platform_verification_records`、`platform_verified_baselines` | `platform_settings` | `/world-tree/` |
| `future-roadmap` | **進階營運閉環** | functional | `promotion_rules`、`tenant_domains`、`membership_plans`、`membership_subscriptions`、`customer_wallets`、`customer_wallet_ledger`、`ai_visual_jobs`、`session_visual_assets`、`marketing_automations`、`marketing_automation_runs`、`translations` | `platform_settings`、`sessions`、`registrations`、`service_items`、`service_visits`、`notifications` | `/workspace/#operations`、`/booking/`、`/market/` |
| `market-app-core` | **Market App 行動核心** | support | `mobile_auth_exchanges`、`mobile_push_devices`、`mobile_push_deliveries` | `platform_members`、`platform_member_identities`、`registrations`、`registration_members`、`seat_operation_logs`、`notifications` | 無直接 UI |
| `project-construction` | **工程專案** | functional-submodule | `construction_projects`、`construction_members`、`construction_stages`、`construction_updates`、`construction_quotes`、`construction_payments`、`construction_expenses`、`construction_signoffs` | — | `/project/` |
| `tenant-reporting` | **報表與匯出** | support | `report_templates`、`report_exports`、`report_download_logs`、`session_stats` | — | `/market/#finance`、`/workspace/#operations` |
| `core-system` | **核心系統與共用保護** | support | `platform_settings`、`error_logs`、`idempotency_keys` | — | 無直接 UI |

## 3｜重要定案

- `project-construction` 正式名稱定為 **工程專案**：8 張 `construction_*` live tables 全部保留並納入模組樹。
- `tenant-reporting` 正式名稱定為 **報表與匯出**：只做報表／read-model，不保存第二套業務主資料。
- `core-system` 正式名稱定為 **核心系統與共用保護**：`platform_settings / error_logs / idempotency_keys`，不做一般選單。
- `market-app-core` 維持 **Market App 行動核心**：是系統支撐模組，不硬塞進 Web 選單。

## 4｜121 張 live table primary owner

| table | primaryOwner | sharedWith |
|---|---|---|
| `admin_login_logs` | `platform-access` | — |
| `ai_visual_jobs` | `future-roadmap` | — |
| `announcements` | `tenant-registration` | — |
| `audit_logs` | `platform-tenant` | `tenant-onsite` |
| `availability_exceptions` | `tenant-operations` | — |
| `availability_rules` | `tenant-operations` | — |
| `billing_entities` | `platform-billing` | — |
| `billing_entity_tenants` | `platform-billing` | — |
| `billing_logs` | `platform-billing` | `platform-products` |
| `billing_monthly_statements` | `platform-billing` | — |
| `billing_payments` | `platform-billing` | — |
| `billing_session_charges` | `platform-billing` | — |
| `booking_calendars` | `tenant-operations` | — |
| `brand_access_requests` | `member-center` | — |
| `brand_members` | `member-center` | `tenant-registration` |
| `brands` | `member-center` | `tenant-registration` |
| `consignment_applications` | `advanced-consignment` | — |
| `consignment_periods` | `advanced-consignment` | — |
| `consignment_products` | `advanced-consignment` | — |
| `construction_expenses` | `project-construction` | — |
| `construction_members` | `project-construction` | — |
| `construction_payments` | `project-construction` | — |
| `construction_projects` | `project-construction` | — |
| `construction_quotes` | `project-construction` | — |
| `construction_signoffs` | `project-construction` | — |
| `construction_stages` | `project-construction` | — |
| `construction_updates` | `project-construction` | — |
| `customer_wallet_ledger` | `future-roadmap` | — |
| `customer_wallets` | `future-roadmap` | — |
| `doing_helper_improvement_queue` | `platform-application` | — |
| `doing_helper_knowledge_entries` | `platform-application` | — |
| `doing_public_support_messages` | `platform-support` | — |
| `doing_public_support_threads` | `platform-support` | — |
| `email_templates` | `tenant-registration` | — |
| `equipment_items` | `tenant-operations` | — |
| `error_logs` | `core-system` | — |
| `events` | `tenant-operations` | — |
| `exposure_orders` | `platform-exposure` | — |
| `exposure_plans` | `platform-exposure` | — |
| `finance_audit_logs` | `tenant-finance` | — |
| `finance_items` | `tenant-finance` | — |
| `finance_ledger` | `tenant-finance` | `advanced-consignment`、`advanced-performance` |
| `force_majeure_logs` | `tenant-registration` | — |
| `idempotency_keys` | `core-system` | — |
| `inventory_movements` | `advanced-consignment` | — |
| `invoices` | `tenant-finance` | `tenant-registration` |
| `marketing_automation_runs` | `future-roadmap` | — |
| `marketing_automations` | `future-roadmap` | — |
| `member_helper_conversations` | `platform-application` | — |
| `member_helper_messages` | `platform-application` | — |
| `member_helper_traces` | `platform-application` | — |
| `members` | `tenant-people` | `member-center`、`tenant-registration` |
| `membership_plans` | `future-roadmap` | — |
| `membership_subscriptions` | `future-roadmap` | — |
| `mobile_auth_exchanges` | `market-app-core` | — |
| `mobile_push_deliveries` | `market-app-core` | — |
| `mobile_push_devices` | `market-app-core` | — |
| `notifications` | `tenant-registration` | `future-roadmap`、`market-app-core`、`platform-support` |
| `onsite_passcodes` | `tenant-onsite` | — |
| `operation_units` | `tenant-operations` | — |
| `payment_allocations` | `tenant-finance` | — |
| `payments` | `tenant-finance` | `platform-exposure`、`tenant-registration` |
| `permissions` | `tenant-people` | — |
| `photo_activities` | `advanced-photo` | — |
| `photo_activity_frames` | `advanced-photo` | — |
| `photo_leads` | `advanced-photo` | — |
| `platform_attribution_events` | `platform-exposure` | — |
| `platform_change_ledger` | `platform-map` | — |
| `platform_dependency_versions` | `platform-map` | — |
| `platform_feature_versions` | `platform-map` | — |
| `platform_issue_records` | `platform-tenant` | — |
| `platform_member_identities` | `member-center` | `market-app-core`、`platform-access`、`platform-application` |
| `platform_members` | `member-center` | `market-app-core`、`platform-access`、`platform-application` |
| `platform_risk_cases` | `platform-tenant` | — |
| `platform_sessions` | `platform-access` | — |
| `platform_settings` | `core-system` | `future-roadmap`、`platform-billing`、`platform-exposure`、`platform-map`、`platform-products`、`platform-visual` |
| `platform_staff` | `platform-access` | `platform-tenant` |
| `platform_verification_records` | `platform-map` | — |
| `platform_verified_baselines` | `platform-map` | — |
| `pos_sale_items` | `advanced-consignment` | — |
| `pos_sales` | `advanced-consignment` | — |
| `promotion_rules` | `future-roadmap` | — |
| `refunds` | `tenant-finance` | `tenant-registration` |
| `registration_items` | `tenant-registration` | `advanced-consignment` |
| `registration_member_invites` | `tenant-registration` | `member-center`、`tenant-onsite` |
| `registration_members` | `tenant-registration` | `market-app-core`、`member-center`、`tenant-onsite` |
| `registrations` | `tenant-registration` | `advanced-performance`、`advanced-seat`、`future-roadmap`、`market-app-core`、`member-center`、`tenant-onsite` |
| `report_download_logs` | `tenant-reporting` | — |
| `report_exports` | `tenant-reporting` | — |
| `report_templates` | `tenant-reporting` | — |
| `resources` | `tenant-operations` | — |
| `reward_ledger` | `platform-billing` | — |
| `role_permissions` | `tenant-people` | — |
| `roles` | `tenant-people` | — |
| `seat_assignments` | `advanced-seat` | — |
| `seat_maps` | `advanced-seat` | — |
| `seat_operation_logs` | `advanced-seat` | `market-app-core`、`tenant-onsite` |
| `service_items` | `tenant-operations` | `future-roadmap` |
| `service_visits` | `tenant-operations` | `future-roadmap` |
| `session_bundles` | `tenant-operations` | — |
| `session_stats` | `tenant-reporting` | — |
| `session_visual_assets` | `future-roadmap` | — |
| `sessions` | `tenant-operations` | `future-roadmap`、`platform-access` |
| `short_links` | `tenant-operations` | — |
| `staff` | `tenant-people` | `platform-access`、`platform-application`、`platform-tenant` |
| `staff_action_logs` | `tenant-people` | `tenant-onsite` |
| `staff_session_permissions` | `tenant-people` | `platform-access`、`platform-tenant` |
| `stalls` | `advanced-seat` | — |
| `support_messages` | `platform-support` | — |
| `support_threads` | `platform-support` | — |
| `tenant_agreement_templates` | `tenant-registration` | — |
| `tenant_apply_logs` | `platform-application` | `member-center` |
| `tenant_customer_profiles` | `tenant-people` | — |
| `tenant_domains` | `future-roadmap` | — |
| `tenant_settings` | `platform-tenant` | `platform-application`、`platform-products`、`tenant-themes` |
| `tenants` | `platform-tenant` | `member-center`、`platform-access`、`platform-application`、`platform-products` |
| `timeslots` | `tenant-operations` | — |
| `transfer_settlements` | `tenant-finance` | — |
| `translations` | `future-roadmap` | — |
| `vendor_sales_reports` | `advanced-performance` | — |
| `venue_map_templates` | `advanced-seat` | — |

## 5｜重建前禁止事項

- 未經 CURRENT Registry 核對，不得刪任何 live table。
- 不得將共用表私有化到單一 UI 模組。
- 不得把 `project-construction / tenant-reporting / core-system / market-app-core` 誤判成舊垃圾。
- 不得用舊 `platform.html / admin.html / member.html / operations-center.html` 當新 UI source；正式 build 已退休這些獨立頁。