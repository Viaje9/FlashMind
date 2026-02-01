import { CanDeactivateFn } from '@angular/router';
import { Observable } from 'rxjs';

/**
 * 具有 canDeactivate 方法的元件介面。
 * 用於讓 guard 檢查元件是否有未儲存的變更。
 */
export interface HasUnsavedChanges {
  canDeactivate(): Observable<boolean> | boolean;
}

/**
 * 未儲存變更的路由離開守衛。
 * 當元件有未儲存的變更時，會呼叫元件的 canDeactivate 方法，
 * 由元件決定是否允許離開（例如彈出確認對話框）。
 */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
  return component.canDeactivate ? component.canDeactivate() : true;
};
