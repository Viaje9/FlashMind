---
title: "Angular Signal Forms 與 async ngSubmit 的問題"
summary: "記錄 Angular Signal Forms 的 submit() 函數搭配 async (ngSubmit) 時會觸發瀏覽器預設表單提交行為的問題"
---

# Angular Signal Forms 與 async ngSubmit 的問題

| 版本 | 日期 | 作者 | 變更說明 |
|------|------|------|----------|
| 1.0  | 2026-01-18 | Claude | 初版建立 |

---

## 問題描述

在使用 Angular Signal Forms（`@angular/forms/signals`）的 `submit()` 函數搭配 `<form (ngSubmit)>` 時，若 `onSubmit()` 是 async 函數，會觸發瀏覽器預設的表單提交行為，導致：

1. 頁面重載
2. HTTP POST 請求未發送
3. URL 變成 `/login?`（帶有空的 query string）
4. 表單欄位被清空

## 重現步驟

```html
<!-- 問題寫法 -->
<form (ngSubmit)="onSubmit()">
  <input [formField]="loginForm.email" />
  <button type="submit">登入</button>
</form>
```

```typescript
// login.component.ts
async onSubmit(): Promise<void> {
  await submit(this.loginForm, async () => {
    // 這裡的 API 呼叫永遠不會執行
    // 因為瀏覽器已經觸發預設表單提交
    return this.authService.login(email, password);
  });
}
```

## 根本原因推測

1. **async 函數的非同步特性**：`(ngSubmit)` 觸發 `onSubmit()` 時，由於函數是 async，Angular 不會等待它完成
2. **事件處理時序**：`submit()` 函數內部可能有 `event.preventDefault()` 的邏輯，但因為 async 導致執行太晚
3. **瀏覽器競爭條件**：瀏覽器的預設表單提交行為先於 `preventDefault()` 執行

這可能是 Angular Signal Forms 的 bug 或設計限制，因為傳統的 Reactive Forms 搭配 async `(ngSubmit)` 不會有此問題。

## 解決方案

### 方案一：在 template 同步阻止預設行為（推薦）

```html
<!-- ✅ 正確寫法 -->
<form (submit)="$event.preventDefault(); onSubmit()">
  <input [formField]="loginForm.email" />
  <button type="submit">登入</button>
</form>
```

**關鍵點**：
- 使用原生 `(submit)` 而非 `(ngSubmit)`
- `$event.preventDefault()` 在同一個同步表達式中執行，確保在瀏覽器處理事件前完成

### 方案二：在 TypeScript 中同步阻止（不可靠）

```typescript
// ❌ 這個方法不可靠
async onSubmit(event?: Event): Promise<void> {
  event?.preventDefault();  // 可能執行太晚
  await submit(this.loginForm, async () => { ... });
}
```

即使在函數第一行呼叫 `preventDefault()`，由於 async 函數的特性，瀏覽器可能已經開始處理預設行為。

### 不推薦的方案

- ❌ 移除 `<form>` 改用 `<div>`（喪失表單語義化和無障礙特性）
- ❌ 使用 `(click)` 取代表單提交（無法用 Enter 鍵提交）

## 測試驗證

修改前後的 E2E 測試結果：

| 測試 | 修改前 | 修改後 |
|------|--------|--------|
| 登入表單點擊提交 | ❌ 頁面重載 | ✅ 通過 |
| 登入表單 Enter 提交 | ❌ 頁面重載 | ✅ 通過 |
| 註冊表單點擊提交 | ❌ 頁面重載 | ✅ 通過 |
| 註冊表單 Enter 提交 | ❌ 頁面重載 | ✅ 通過 |

## 相關檔案

- `apps/web/src/app/pages/login/login.component.html`
- `apps/web/src/app/pages/login/login.component.ts`
- `apps/web/src/app/pages/register/register.component.html`
- `apps/web/src/app/pages/register/register.component.ts`

## 學習要點

1. **Signal Forms 是實驗性功能**：`@angular/forms/signals` 仍在開發中，可能有未預期的行為
2. **事件處理的同步性**：阻止瀏覽器預設行為必須是同步的，不能依賴 async 函數
3. **Template 優先於 TypeScript**：在 template 中處理 `preventDefault()` 比在 TypeScript 中更可靠
4. **保持表單語義化**：即使遇到問題，也應優先尋找保留 `<form>` 元素的解法

## 後續追蹤

- [ ] 確認這是否為 Angular Signal Forms 的已知 issue
- [ ] 向 Angular 團隊回報此問題（如果是 bug）
- [ ] 追蹤 Angular 版本更新是否修復此問題
