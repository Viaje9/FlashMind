import { OverlayRef } from '@angular/cdk/overlay';
import { Observable, Subject } from 'rxjs';

export class DialogRef<T = any, R = any> {
  private readonly afterClosedSubject = new Subject<R | undefined>();

  constructor(private overlayRef: OverlayRef) {}

  /**
   * 關閉對話框
   * @param result 要回傳給呼叫者的結果
   */
  close(result?: R): void {
    this.overlayRef.dispose();
    this.afterClosedSubject.next(result);
    this.afterClosedSubject.complete();
  }

  /**
   * 對話框關閉後的 Observable
   */
  afterClosed(): Observable<R | undefined> {
    return this.afterClosedSubject.asObservable();
  }

  /**
   * 取得背景遮罩點擊事件
   */
  backdropClick(): Observable<MouseEvent> {
    return this.overlayRef.backdropClick();
  }

  /**
   * 取得鍵盤事件
   */
  keydownEvents(): Observable<KeyboardEvent> {
    return this.overlayRef.keydownEvents();
  }
}
