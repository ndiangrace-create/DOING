# DOING 2.0｜固定產品開發語法｜2026-08-22

> 本檔為新增固定語法。不得覆蓋、刪除或改寫既有 DOING 指令、世界樹、資料表命名、產品規則與驗證紀錄。

## 固定產品拆分

DOING 2.0 Hub
├─ DOING Market｜市集／活動／體驗
├─ DOING Project｜室內設計／工程專案
├─ DOING Booking｜美類／一般服務預約
└─ DOING Guide｜導覽員／導覽預約

## 固定開發順序

1. DOING Market：現在主線，先完成可營運、可交付夥伴、可販售的市集／活動／體驗系統。
2. DOING Project：第二主線。以已在其他開發脈絡完成的室內設計模擬原型為基礎，後續接續，不重做既有成果。
3. DOING Booking：第三主線。美類／一般服務預約，沿用既有通用 booking 核心，後續重做日曆優先 UX。
4. DOING Guide：第四主線。導覽員／導覽預約，後續獨立設計；可共用既有 booking／event／registration／payment／notification／QR 核心。

## DOING 2.0 Hub 規則

- Hub 只負責共用登入、我的報名、我的營運、我的品牌、通知、客服與切換產品。
- Hub 不塞入各產品的日常營運操作。
- 各產品使用獨立頁面／操作 UX，但共用同一 DOING Core、API 與 Supabase SSOT。

## 資料與功能保護規則

- 舊 DOING 已開發功能、插件、API、資料表、權限、舊世界樹全部保留，視為既有能力庫。
- 2.0 重做操作層，不重建正式資料庫。
- 同功能必須沿用現有正式資料表名稱；不得因新增獨立頁面建立同功能異名表。
- 若真的需要新資料結構，必須先證明現有資料表不能承載，列出新增內容、影響與原因，取得使用者明確確認後才能建立。
- 正式金額、名額、付款、退款、排位、權限由後端／Supabase 裁決，不可由前端自行推算。
- 每個正式操作維持：頁面 → API/Worker → Supabase → 重讀 → 畫面。

## 世界樹版本規則

- `DOING_2.0_WORLD_TREE_V1_BASELINE_20260822.md` 為不可覆蓋初始基準。
- 後續新功能／流程新增：建立新版世界樹並追加 ChangeLog。
- 優化既有流程：更新新版世界樹，但必須保留前一版與修改原因。
- 不得回頭改寫 v1 造成需求漂移。

## 目前頁面契約

- `doing-2.html`：DOING 2.0 Hub
- `market-center.html`：DOING Market
- `project-center.html`：DOING Project
- `booking-2-center.html`：DOING Booking
- `guide-center.html`：DOING Guide

## 當前執行範圍

只繼續完成 DOING Market。Project／Booking／Guide 目前只建立獨立入口與固定開發節點，不搶用 Market 開發資源；除非使用者明確切換主線。