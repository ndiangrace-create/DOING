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
