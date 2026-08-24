# DOING Repository 結構規則

DOING GitHub 從 2026-08-24 起採「目前版本為主、Git 歷史負責回溯」原則，禁止再用大量版本檔、測試附件與臨時分支當永久儲存。

## 正式內容

- 根目錄：目前正式產品 source、目前 SSOT、目前 ChangeLog／世界樹。
- `modules/`：仍在正式產品使用的獨立模組 source。
- `scripts/`：建置與自動驗證。
- `database/`：後續逐步收斂資料庫 SQL；本輪不搬既有 SQL，避免一次影響太多固定路徑。
- `docs/archive/2026-08/`：歷史版本文件，只供回溯，不再修改。

## 固定規則

1. 世界樹只更新目前 SSOT，不再新增 `WORLD_TREE_Vxx_日期.md`。
2. 更新紀錄只追加目前 ChangeLog，不再新增 `CHANGELOG_Vxx_日期.md`。
3. 驗收結果留在 GitHub Checks／正式 verification SSOT；不再上傳 PNG、ZIP、網站 build、deployment JSON artifact。
4. 臨時分支在 PR 合併／關閉後清除；正式長期分支只保留 `main`。
5. 不建立 `legacy-pages/`；仍使用的功能必須搬回 `modules/` 或正式 source。
6. 不保存版本化 UAT HTML 快照；UAT 使用 `scripts/e2e-*.mjs` 即時驗證。
7. GitHub Actions log 不作永久產品資料來源。
8. 正式營運資料仍只在 DOING Core／Supabase SSOT，不放 GitHub。

## 目前重要 SSOT

- `doing-world-tree-current.json`
- `DOING_2.0_CHANGELOG.md`
- `DOING_OPERATIONAL_WORLD_TREE.md`
- `DOING_RELEASE_POLICY_CURRENT.md`
- `DOING_產品規則與更新紀錄.md`
- `doing-data-sources.json`
- `doing-capabilities.json`

歷史內容需要找回時優先使用 Git commit history，不再複製一份新檔案到根目錄。
