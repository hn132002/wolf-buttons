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

不建立 `/okinawa`、`/okinawa?edit=1`、`/api/okinawa/*`，也不依賴 ephemeral-board。

## 資料欄位

`CommunicationCard`：

- `id String @id @default(cuid())`
- `emoji String`
- `label String`
- `labelJa String?`
- `zh String`
- `ja String`
- `en String?`
- `note String?`
- `categories String[]`
- `sortOrder Int @default(0)`
- `isVisible Boolean @default(true)`
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
- 只顯示 `isVisible=true`。

## 介面語言

- 支援中文與日本語。
- 中文按鈕顯示 `emoji + label`。
- 日本語按鈕顯示 `emoji + labelJa`，空白時 fallback `label`。
- UI 語言存在 `localStorage` key `wolfButtons.uiLanguage`，只存 `zh` / `ja`。
- 分類名稱不翻譯。

## 分類規則

- 分類來自字卡 `categories`，不寫死、不翻譯、不設上限。
- 依排序後字卡中第一次出現的順序顯示。
- 清理空字串，同名分類不重複。
- TSV categories 用 `|` 分隔。

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

- 字卡總覽包含 hidden cards。
- 單張新增、編輯、顯示/隱藏、hard delete。
- 單張表單欄位：categories、emoji、label、labelJa、zh、ja、en、note、sortOrder、isVisible。
- 必填：categories 至少一項、emoji、label、zh、ja。
- 可空：labelJa、en、note。
- `sortOrder` 必須為整數。
- DELETE 是 hard delete，不使用 `?hard=1`；隱藏只用 `PATCH isVisible=false`。

## TSV 格式

固定 header：

```tsv
id	categories	emoji	label	labelJa	zh	ja	en	note	sortOrder	isVisible
```

- 匯出全部字卡，包含 hidden。
- categories 用 `|` 分隔。
- `isVisible` 輸出 `TRUE` / `FALSE`。
- null 輸出空字串。
- 匯入 boolean 接受 `TRUE`、`FALSE`、`true`、`false`、`1`、`0`。
- 匯入前必須解析預覽，有錯誤不得套用。
- 預覽顯示總列數、新增、更新、隱藏、顯示、刪除、錯誤與逐列錯誤。

## 增加／修改模式

API mode 為 `upsert`。

- id 空白且 `isVisible=true`：新增。
- id 有值且存在：更新該卡所有 TSV 欄位。
- id 有值但不存在：錯誤。
- id 空白且 `isVisible=false`：錯誤。
- `isVisible=false`：保留資料但隱藏。
- TSV 未出現的既有卡完全不動。
- 整批操作在 transaction 內完成。

## 完全取代模式

API mode 為 `replace`。

- TSV 是新的完整資料來源。
- id 空白：新增。
- id 有值且存在：更新。
- id 有值但不存在：錯誤。
- `isVisible=false`：保留但隱藏。
- 既有 DB 字卡未出現在 TSV：hard delete。
- 套用前二次確認：「TSV 未包含的既有字卡會直接刪除，且無法復原。」
- 整批操作在 transaction 內完成。

## API 安全

- 公開 GET 不需要 admin secret，只回傳 `isVisible=true`。
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
