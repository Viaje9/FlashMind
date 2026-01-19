import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { DialogService } from '@flashmind/ui';
import { provideApi } from '@flashmind/api-client';
import { errorInterceptor } from './interceptors/error.interceptor';
import { loadingInterceptor } from './interceptors/loading.interceptor';

function getApiBasePath(): string {
  const hostname = window.location.hostname;
  const apiPort = 3280;
  // 如果是 localhost 就用 localhost，否則用當前 hostname（支援手機區網測試）
  return `http://${hostname}:${apiPort}`;
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
