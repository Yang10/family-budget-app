# Family Budget App

簡單的家庭記帳 PWA — 純前端 (HTML/CSS/JS)，資料同步到 Google Sheets，部署在 GitHub Pages。

**線上網址**：https://yang10.github.io/family-budget-app/

## 技術棧

- **前端**：原生 HTML / CSS / JavaScript（無框架、無 build step）
- **圖表**：Chart.js (CDN)
- **資料儲存**：
  - 主要：Google Apps Script Web App → Google Sheets (`SCRIPT_URL` 在 [app.js:5](app.js:5))
  - 離線備份：`localStorage`（key prefix `fb_`）
- **PWA**：`manifest.json` + apple-touch-icon
- **部署**：GitHub Pages（push 到 `main` 自動部署，~30 秒）

## 檔案結構

- [index.html](index.html) — 三個 tab 的 SPA 殼（記帳 / 報表 / 盤點）
- [app.js](app.js) — 所有業務邏輯（state、render、Google Sheets 同步）
- [style.css](style.css) — 樣式
- [manifest.json](manifest.json) — PWA manifest

## 重要慣例

- **密碼鎖**：`SECURITY_PIN` 寫在 [app.js:8](app.js:8)（純前端，不是真安全機制）
- **快取破解**：`index.html` 用 JS 動態加 `?v=YYYYMMDD` query string 載入 `app.js` 和 `style.css`，每天自動換版本號，使用者不用手動清快取
- **記帳人**：固定兩個人 `揚` (老公) / `妡` (老婆)
- **localStorage keys**：`fb_transactions`、`fb_accounts`、`fb_last_inventory`、`fb_inventory_history`、`fb_savings_goals`
- **預設帳戶清單**：寫死在 [app.js:13](app.js:13) 的 `defaultAccounts`
- **分類**：寫死在 [app.js:32](app.js:32) 的 `categories`、icon/color 在後面

## 已知 iOS 修正

- 用 JS 動態算 `--app-height`（`setAppHeight`）避免 iOS Safari 底部空白
- `overflow: hidden` 在 body / html
- `lock-screen` 用 fixed positioning

## 工作流程

1. 改完 → `git add` → `git commit` → `git push origin main`
2. GitHub Pages 自動部署（~30 秒，可用 `gh api /repos/Yang10/family-budget-app/pages/builds/latest` 查狀態）
3. 因為有 `?v=YYYYMMDD`，使用者隔天打開會自動拿新版

## 開發注意事項

- **不要加 build step**：刻意保持純前端，使用者要能直接在 GitHub 編輯
- **不要把 PIN / SCRIPT_URL 當真安全機制**：前端 JS 都看得到，這個 app 是給家人用的內部工具
- **任何 user-controlled 字串渲染到 DOM 都要 escape**：用 `escapeHtml()`（[app.js](app.js)）
- **雲端 fetch 一律走 `fetchWithTimeout`**：避免網路爛掉時 app 卡死
