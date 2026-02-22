import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { DialogService } from '@flashmind/ui';
import { provideApi } from '@flashmind/api-client';
import { errorInterceptor } from './interceptors/error.interceptor';
import { loadingInterceptor } from './interceptors/loading.interceptor';
import { environment } from '../environments/environment';

function getApiBasePath(): string {
  if (environment.apiUrl) {
    return environment.apiUrl;
  }
  // 預設使用同源 /api，避免 HTTPS 頁面呼叫 HTTP API 造成混合內容錯誤
  return '/api';
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([loadingInterceptor, errorInterceptor])),
    provideApi({
      basePath: getApiBasePath(),
      withCredentials: true,
    }),
    DialogService,
  ],
};
