# DOING UI HOME V1｜CURRENT

日期：2026-08-25
狀態：Implementation branch / awaiting CI + user release confirmation

## 本次重建範圍

已重新建立並接回 CURRENT Core 的正式操作面：

- `/`：DOING 日系軟萌果凍風首頁
- `/me/`：LINE 會員登入＋租戶工作空間清單
- `/workspace/`：依正式租戶權限顯示可用系統分類
- `/market/`：市集活動系統入口
- `/project/`：室內設計進度系統入口
- `/booking/`：美類預約系統入口

仍維持 rebuild shell：

- `/market/public/`
- `/market/session/`
- `/guide/`
- `/apply/`
- `/register/`
- `/world-tree/`

## 首頁正式分類

1. 市集活動
2. 室內設計進度
3. 美類預約

首頁提供：
- DOING 功能說明
- 搜尋／快速分類
- 三大系統入口
- 申請使用入口
- 我的 DOING 登入入口
- 底部主導覽：報名活動／我的 DOING／線上客服

## 登入閉環

`/me/` 使用現有 Core：

- `GET /auth/line/start?mode=member`
- `getPlatformMemberProfile`
- `createMemberWorkspaceAdminSession`

成功後：

`LINE 登入 → member_token → 我的 DOING → 選擇租戶 → admin_token → /workspace/`

`/workspace/` 再以：

- `adminMe`
- `getTenantModuleProfile`

判斷該租戶正式核准的系統，未核准功能不開啟。

## SSOT／安全

- Supabase：不改 schema、不改資料、不新增第二套表。
- Worker：不修改 `worker.js / worker.txt`。
- Core：沿用 `tobeloved-api`。
- 2BL：0 變更。
- 權限：前端只呈現；正式租戶與 admin token 仍由後端 Core 裁決。

## 視覺基準

唯一方向：日系軟萌果凍風（Kawaii Pastel 3D）。

- 粉彩水彩背景
- 厚實內凹粉色搜尋框
- 3D 果凍 CTA
- 卡片陰影只用淡紫／淡藍／淡色，不用黑色重陰影
- 三顆固定底部果凍主按鈕
- 桌面三欄系統卡；手機單欄，底部導覽維持三等分
- HTML5 + Tailwind CDN + DOING 自有果凍 CSS

## Release Gate

本次「開始」只授權開發，不視為正式發布授權。

通過 GitHub CI、Real-browser mobile/desktop E2E 後停在 Release Ready；收到明確 `確認發布`／`確認部署` 才合併 main 與正式 Pages 部署。
