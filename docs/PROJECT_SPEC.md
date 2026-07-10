# 狼狼按鈕 Project Spec

狼狼按鈕是雙向、低阻力、按鈕式、跨語言情境溝通工具。首頁第一目的為立即按卡溝通，不是翻譯器、聊天室、完整 AAC 字典、Landing Page 或文章網站。

## 路由

- `/`：公開使用頁。
- `/admin`：管理頁。
- `GET /api/cards`：公開讀取 visible cards。
- `GET /api/cards?includeHidden=1`：admin-only 讀取全部 cards。
- `POST /api/cards`：admin-only 新增單張。
- `PATCH /api/cards/[id]`：admin-only 修改單張。
- `DELETE /api/cards/[id]`：admin-only hard delete。
- `POST /api/cards/batch`：admin-only 批次 upsert / replace。
- `GET /api/card-categories`：公開讀取未隱藏分類與虛擬未分類。
- `/api/admin/card-categories/*`：admin-only 管理分類、隱藏與排序。
- `DELETE /api/admin/card-categories/[id]/cards`：admin-only hard delete 該分類下全部字卡。

不建立 `/okinawa`、`/okinawa?edit=1`、`/api/okinawa/*`，也不依賴 ephemeral-board。

## 資料欄位

`CommunicationCard`：

- `id String @id @default(cuid())`
- `emoji String`：保留舊欄位，新流程固定空字串。
- `label String`：按鈕中文，可空白。
- `labelJa String?`
- `zh String`：內文中文，可空白。
- `ja String`：內文日文，可空白。
- `en String?`
- `note String?`：保留舊欄位，新流程固定 null。
- `categories String[]`
- `sortOrder Int @default(0)`：保留舊欄位。
- `isVisible Boolean @default(true)`：保留舊欄位；單張字卡不再提供隱藏功能。
- `createdAt DateTime @default(now())`
- `updatedAt DateTime @updatedAt`

排序固定為 `sortOrder asc`、`createdAt asc`、`id asc`。零張字卡是正式支援狀態，不自動 seed。

## 公開頁行為

- 固定深色模式，mobile first，操作區最大約 430px。
- 結構：完整內容展示區、中文/日本語切換、分類橫向列、三欄字卡、小型管理入口。
- 初始不自動選卡，顯示「請點一張字卡 / カードを選んでください / Tap a card」。
- 點字卡後展示順序固定為中文、日文、英文、備註。
- `aria-live="polite"`。
- 切語言不改展示順序，不隱藏另一種語言。
- 切分類不自動選卡、不改目前展示訊息。
- 單張字卡不做隱藏；分類隱藏時，該分類與其字卡不出現在使用者端。

## 介面語言

- 支援中文與日本語。
- 中文按鈕顯示 `label`，空白時 fallback `labelJa`，仍空白顯示 `-`。
- 日本語按鈕顯示 `labelJa`，空白時 fallback `label`，仍空白顯示 `-`。
- UI 語言存在 `localStorage` key `wolfButtons.uiLanguage`，只存 `zh` / `ja`。
- 分類名稱不翻譯。

## 分類規則

- 分類由 `CommunicationCategory` 管理，可新增、刪除、改名、排序、隱藏。
- 字卡沒有分類時，公開端以虛擬「未分類」顯示；未分類不寫入分類資料表。
- 刪除單一分類時，該分類下字卡改為未分類。
- 分類隱藏時，公開端隱藏分類與該分類下字卡；管理端仍可編輯。

## 管理驗證

- `ADMIN_SECRET` 只能由 server 端讀取 `process.env.ADMIN_SECRET`。
- 所有 admin request 必須帶 `x-admin-secret`。
- `ADMIN_SECRET` 未設定時 fail closed。
- 未登入管理頁只顯示標題、password input、進入按鈕、錯誤區、返回使用模式連結。
- password input 不預填，支援 Enter，`autocomplete="current-password"`。
- 成功後 secret 暫存在 `sessionStorage` key `wolfButtons.adminSecret`。
- reload 後必須重新打 API 驗證，不可只因 sessionStorage 有值就解鎖。
- 錯誤密碼與離開管理模式都清除 sessionStorage。

## 管理功能

- 字卡總覽包含全部字卡。
- 單張新增、編輯、hard delete。
- 單張表單欄位：category、label、labelJa、zh、ja、en。
- 單張新增/編輯可直接輸入新分類；不存在的分類會自動建立。
- 文字欄位皆可空白；畫面空白顯示 `-`。
- 單張字卡不支援隱藏；隱藏只在分類層級。
- 可 hard delete 單一分類下全部字卡，分類本身保留。
- 「全部字卡與分類刪除」會 hard delete 全部字卡與全部分類。

## TSV 格式

固定 header：

```tsv
id	category	label	labelJa	zh	ja	en
```

- 匯出全部字卡。
- category 可空白；空白或 `未分類` 都視為未分類。
- null 輸出空字串。
- 匯入前必須解析預覽，有錯誤不得套用。
- 預覽顯示總列數、新增、更新、刪除、錯誤與逐列錯誤。

## 增加／修改模式

API mode 為 `upsert`。

- id 空白：新增。
- id 有值且存在：更新該卡所有 TSV 欄位。
- id 有值但不存在：錯誤。
- TSV 未出現的既有卡完全不動。
- 整批操作在 transaction 內完成。

## 完全取代模式

API mode 為 `replace`。

- TSV 是新的完整資料來源。
- id 空白：新增。
- id 有值且存在：更新。
- id 有值但不存在：錯誤。
- 既有 DB 字卡未出現在 TSV：hard delete。
- 套用前二次確認：「TSV 未包含的既有字卡會直接刪除，且無法復原。」
- 整批操作在 transaction 內完成。

## API 安全

- 公開 GET 不需要 admin secret。
- includeHidden、POST、PATCH、DELETE、batch 都是 admin-only。
- 回應不包含 server secret。
- DB 錯誤只回一般化訊息，不輸出連線資訊。

## 驗收標準

- `npm run lint`
- `npm run build`
- `npm run test:cards`
- `git diff --check`
- `npx prisma generate`
- `npx prisma validate`
- `npx prisma migrate status`
- 本機 smoke test：公開頁、管理頁、API auth、零資料、新增、編輯、隱藏、hard delete、TSV export、upsert、replace。
- 視覺檢查 390x844、430x932、1440px，確認深色、無巨大 hero、三欄字卡、分類可橫向捲動、無水平溢出、管理頁未驗證不洩漏內容。
