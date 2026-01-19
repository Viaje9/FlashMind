import { HttpInterceptorFn, HttpContextToken } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from '../services/loading.service';

export const SKIP_LOADING = new HttpContextToken<boolean>(() => false);

// 不顯示全螢幕 Loading 的 URL 模式
const SKIP_LOADING_PATTERNS = [
  /\/tts\//,  // TTS 相關請求
];

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loadingService = inject(LoadingService);

  // 檢查是否應該跳過 loading
  const shouldSkip = req.context.get(SKIP_LOADING) ||
    SKIP_LOADING_PATTERNS.some(pattern => pattern.test(req.url));

  if (shouldSkip) {
    return next(req);
  }

  loadingService.show();

  return next(req).pipe(
    finalize(() => {
      loadingService.hide();
    }),
  );
};
