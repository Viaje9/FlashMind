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
  // 開發環境：使用當前 hostname 搭配 API port（支援手機區網測試）
  const hostname = window.location.hostname;
  const apiPort = 3280;
  return `http://${hostname}:${apiPort}/api`;
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
