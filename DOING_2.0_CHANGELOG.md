# DOING 2.0 ChangeLog

> 規則：只追加，不覆蓋歷史版本。任何新功能、流程優化、頁面重新分類、資料契約調整，都必須先核對 DOING_2.0_WORLD_TREE_V1_BASELINE_20260822.md，再新增紀錄。

## 2026-08-22｜v1 Baseline

- 正式建立 DOING 2.0 定義。
- 舊 DOING 全功能封存為既有能力庫，不刪除、不重做。
- Supabase DOING_SaaS 繼續作唯一正式資料來源。
- 同功能不得新開異名資料表；新增資料表需使用者確認。
- Market 為第一優先產品；主辦操作骨架固定為：場次 → 待辦 → 現場 → 會員 → 設定。
- Market 第一階段收費／繳費沿用 2BL 習慣。
- 現場主要過渡操作：當日名單／該場次全名單 → 搜尋姓名／品牌 → 一鍵報到。
- QR 功能需完整保留與完成，但第一階段不強制夥伴使用。
- Booking 第二優先；Project 後續。

## 2026-08-22｜Market 2.0 操作層開始

- 建立工作分支 `feature/doing-market-2.0-20260822`。
- 開始建立 `market-center.html` 作為 DOING Market 專用營運入口。
- 第一版只重排操作，不修改資料表、不新增正式資料、不破壞既有 admin／onsite／member 功能。

## 2026-08-22｜v2 產品獨立頁與開發排序

- 保留 v1 不修改，新增 `DOING_2.0_WORLD_TREE_V2_PRODUCT_SPLIT_20260822.md`。
- 新增固定產品開發語法 `DOING_2.0_PRODUCT_ROADMAP_FIXED_20260822.md`；既有語法不改。
- 建立 `doing-2.html` 作為 DOING 2.0 Hub。
- `market-center.html` 保持 DOING Market 獨立產品頁，現在主線繼續完成。
- 建立 `project-center.html` 作為 DOING Project 獨立入口；第二主線為室內設計／工程專案，後續接續既有模擬原型，不重做。
- 建立 `booking-2-center.html` 作為 DOING Booking 獨立入口；第三主線為美類／一般服務預約。
- 建立 `guide-center.html` 作為 DOING Guide 獨立入口；第四主線為導覽員／導覽預約。
- 四個產品共用同一 DOING Core／API／Supabase SSOT；獨立頁面不得衍生第二套同功能資料。
- 本次只建立產品頁骨架與固定規則，不新增資料表、不修改正式營運資料、不部署。