import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ApiError } from '../models/api-error';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
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
