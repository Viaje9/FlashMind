---
title: "頁首右上設定消失問題（內容投影）"
summary: "記錄頁首設定按鈕消失的根因與修正思路。"
---

# 頁首右上設定消失問題（內容投影）

## 問題描述

- 頁面：`/decks`
- 現象：頁首右上「設定」按鈕不見。

## 根因

`fm-page-header` 使用 Angular 內容投影（`<ng-content>`）來放左/右側操作按鈕，但模板中用 `@if / @else` 分成兩套結構，各自包含一組 `ng-content`。

Angular 的投影內容只會分配到「第一組」符合的 `ng-content`。因此在 `layout="start"` 時，左右 slot 落在另一個未渲染分支，導致右側按鈕消失。

## 錯誤範例（保留原始寫法）{#bad-example}

以下是當時的寫法（重複投影點），用來對照問題來源：  

```html
@if (layout() === 'center') {
  <div class="flex items-center gap-3">
    <ng-content select="[slot=left]"></ng-content>
  </div>
  <div class="flex flex-col items-center text-center flex-1">
    <h1 class="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
      {{ title() }}
    </h1>
    @if (subtitle()) {
      <span class="text-xs font-medium text-secondary-text">{{ subtitle() }}</span>
    }
  </div>
  <div class="flex items-center gap-2">
    <ng-content select="[slot=right]"></ng-content>
  </div>
} @else {
  <div class="flex items-center gap-3">
    <ng-content select="[slot=left]"></ng-content>
    <div class="flex flex-col">
      <h1 class="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
        {{ title() }}
      </h1>
      @if (subtitle()) {
        <span class="text-xs font-medium text-secondary-text">{{ subtitle() }}</span>
      }
    </div>
  </div>
  <div class="flex items-center gap-2">
    <ng-content select="[slot=right]"></ng-content>
  </div>
}
```

## 解法

1. **移除分支內重複的投影點**，改成單一結構承載左右與標題。
2. 以 `grid` 佈局維持三欄（左/中/右），並用 `titleClass` 控制標題對齊（置中或靠左）。
3. 左右操作按鈕以 class 標記投影來源：
   - 左側：`fm-header-left`
   - 右側：`fm-header-right`

## 解決方式（修正後範例）

以下是修正後的 `fm-page-header` 範例，保留單一投影結構並用 grid 排版：

```html
<header [class]="containerClass()">
  <div class="flex items-center gap-3">
    <ng-content select=".fm-header-left"></ng-content>
  </div>
  <div [class]="titleClass()">
    <h1 class="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
      {{ title() }}
    </h1>
    @if (subtitle()) {
      <span class="text-xs font-medium text-secondary-text">{{ subtitle() }}</span>
    }
  </div>
  <div class="flex items-center gap-2 justify-end">
    <ng-content select=".fm-header-right"></ng-content>
  </div>
</header>
```

對應的 TypeScript 設定：

```ts
readonly containerClass = computed(() => {
  const base =
    'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm transition-colors duration-200';
  const spacing = this.dense() ? 'px-4 py-2' : 'px-4 py-3';
  const sticky = this.sticky() ? 'sticky top-0 z-30' : '';

  return [base, spacing, sticky].filter(Boolean).join(' ');
});

readonly titleClass = computed(() => {
  const base = 'flex flex-col';
  const align = this.layout() === 'center' ? 'items-center text-center' : 'items-start text-left';

  return [base, align].join(' ');
});
```

## 變更摘要

- `packages/ui/src/lib/molecules/page-header/page-header.component.html`
  - 移除 `@if/@else` 內的重複 `ng-content`，改為單一結構。
- `packages/ui/src/lib/molecules/page-header/page-header.component.ts`
  - 新增 `titleClass`，依 `layout` 控制標題對齊。
  - `containerClass` 改用有效的 `grid-template-columns`。
- 使用頁面（例如 `deck-list`, `settings` 等）將原本的 `slot=left/right` 改為 `class="fm-header-left/right"`。

## 驗證方式

- Chrome DevTools 檢查 `/decks` 頁首是否出現右上「設定」。
- 檢查 `/settings` 是否有左側返回與右側完成按鈕。

## 教訓/避免再次發生

- 內容投影不要放在互斥的 template 分支中；必要時用單一結構與樣式控制呈現差異。
- 若要支援多種版型，優先用 class 或 layout 變數調整，而不是用 `@if` 複製整段 HTML。
