# DOING 市集／活動整併候選補丁

狀態：已實作、已在本機隔離驗證；尚未部署。大型 Worker 原始碼透過連接器寫入兩次中斷，因此此草稿暫以可完整還原的補丁保存。這個分支的產品原始碼尚未套用，不能直接合併或拿來部署。

- 基準：`55f7584eb1de35c762cac28bb51289f7d999619e`
- 套用後已核對的 Git tree：`4d05922bc685f89cca192568c0a48508fa75d441`
- 35 個檔案的實作／測試／文件修改，分為 8 份文字補丁；保留既有 UI 與市集／活動共用流程。
- 本機核心 30 組通過；桌機／手機流程通過。真實 LINE、付款服務與正式資料庫 UAT 尚未完成。
- 目前正式站存在這份基準未包含的 API，須先取得正式來源並比對，不能整包覆蓋 Worker。
- 敏感帳號、租戶及資料庫對應留在使用者非公開紀錄，不包含於此公開候選包。

## 在隔離 checkout 還原

在上述基準的乾淨 checkout，將本目錄 patches 複製到 checkout 外，再執行：

```sh
git apply --check /absolute/path/to/patches/changes-*.patch
git apply /absolute/path/to/patches/changes-*.patch
npm ci --ignore-scripts
npm run build
npm run test:market:core
npx playwright install --with-deps chromium
npm run test:market:browser
```

完整實作與驗收限制位於套用後的 `docs/market-activity-consolidation-20260929.md`。草稿 CI 僅在 runner 的暫存 checkout 套用並驗證，不推送程式、不改 main、不部署、不寫正式資料。

## 下一步

1. 完成雲端隔離驗證及不公開識別碼的正式來源相符性檢查。
2. 保存並取得正式 Worker／前端來源，以目前正在使用的接口為準整合修正。
3. 將補丁實際套用成可審查的來源提交，再用正確測試租戶完成真實登入、報名、審核、付款確認與報到。
4. 正式來源和 UAT 完成後才交使用者確認部署；目前不是發布版本。
