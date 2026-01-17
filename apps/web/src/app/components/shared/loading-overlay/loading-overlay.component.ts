import { Component } from '@angular/core';

@Component({
  selector: 'app-loading-overlay',
  standalone: true,
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div class="flex flex-col items-center gap-4">
        <div class="relative">
          <div
            class="h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-white"
          ></div>
        </div>
        <span class="text-sm font-medium text-white">載入中...</span>
      </div>
    </div>
  `,
})
export class LoadingOverlayComponent {}
