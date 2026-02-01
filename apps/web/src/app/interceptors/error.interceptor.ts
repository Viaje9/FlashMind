import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ApiError } from '../models/api-error';
import { DialogService, FmAlertDialogComponent } from '@flashmind/ui';

let isHandling401 = false;

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const dialogService = inject(DialogService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const isAuthEndpoint = req.url.includes('/auth/');
      if (err.status === 401 && !isHandling401 && !isAuthEndpoint) {
        isHandling401 = true;

        const dialogRef = dialogService.open(FmAlertDialogComponent, {
          data: {
            title: '登入已過期',
            message: '您的登入已過期，請重新登入。',
            buttonText: '前往登入',
          },
          closeOnBackdropClick: false,
          closeOnEsc: false,
        });

        dialogRef.afterClosed().subscribe(() => {
          isHandling401 = false;
          router.navigate(['/login']);
        });
      }

      const message = err.error?.error?.message || getDefaultMessage(err.status);
      const code = err.error?.error?.code;

      return throwError(() => new ApiError(message, code, err.status));
    })
  );
};

function getDefaultMessage(status: number): string {
  switch (status) {
    case 0:
      return '無法連線到伺服器，請檢查網路連線';
    case 401:
      return '請重新登入';
    case 403:
      return '您沒有權限執行此操作';
    case 404:
      return '找不到請求的資源';
    case 500:
      return '伺服器發生錯誤，請稍後再試';
    default:
      return '發生未知錯誤，請稍後再試';
  }
}
