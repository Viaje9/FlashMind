import { Injectable, Injector, inject, Type, InjectionToken } from '@angular/core';
import { Overlay, OverlayConfig, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { DialogRef } from './dialog-ref';
import { DialogConfig, DEFAULT_DIALOG_CONFIG } from './dialog-config';

export const DIALOG_CONFIG = new InjectionToken<DialogConfig>('DIALOG_CONFIG');

@Injectable()
export class DialogService {
  private readonly overlay = inject(Overlay);
  private readonly injector = inject(Injector);
  private openDialogs: DialogRef[] = [];

  /**
   * 開啟自訂元件對話框
   */
  open<T, D = any, R = any>(component: Type<T>, config?: DialogConfig<D>): DialogRef<T, R> {
    const dialogConfig = { ...DEFAULT_DIALOG_CONFIG, ...config };
    const overlayRef = this.createOverlay(dialogConfig);
    const dialogRef = new DialogRef<T, R>(overlayRef);

    // 在容器中渲染自訂元件
    this.attachDialogContent(component, overlayRef, dialogRef, dialogConfig);

    // 處理背景點擊和 ESC 鍵
    this.setupDialogBehaviors(dialogRef, dialogConfig);

    this.openDialogs.push(dialogRef);

    return dialogRef;
  }

  /**
   * 關閉所有對話框
   */
  closeAll(): void {
    this.openDialogs.forEach((dialog) => dialog.close());
  }

  /**
   * 取得所有開啟的對話框
   */
  getOpenDialogs(): DialogRef[] {
    return this.openDialogs;
  }

  private createOverlay(config: DialogConfig): OverlayRef {
    const overlayConfig = this.getOverlayConfig(config);
    return this.overlay.create(overlayConfig);
  }

  private getOverlayConfig(config: DialogConfig): OverlayConfig {
    const positionStrategy = this.overlay.position().global();

    // 根據 config.position 設定位置
    switch (config.position) {
      case 'top':
        positionStrategy.top('80px').centerHorizontally();
        break;
      case 'bottom':
        positionStrategy.bottom('80px').centerHorizontally();
        break;
      case 'center':
      default:
        positionStrategy.centerHorizontally().centerVertically();
    }

    const panelClasses = ['fm-dialog-panel'];
    if (config.panelClass) {
      if (Array.isArray(config.panelClass)) {
        panelClasses.push(...config.panelClass);
      } else {
        panelClasses.push(config.panelClass);
      }
    }

    return new OverlayConfig({
      hasBackdrop: config.hasBackdrop,
      backdropClass: 'fm-dialog-backdrop',
      panelClass: panelClasses,
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.block(),
      minWidth: config.minWidth,
      maxWidth: config.maxWidth,
      minHeight: config.minHeight,
      maxHeight: config.maxHeight,
    });
  }

  private createInjector(dialogRef: DialogRef, config: DialogConfig): Injector {
    return Injector.create({
      parent: this.injector,
      providers: [
        { provide: DialogRef, useValue: dialogRef },
        { provide: DIALOG_CONFIG, useValue: config },
      ],
    });
  }

  private attachDialogContent<T>(
    component: Type<T>,
    overlayRef: OverlayRef,
    dialogRef: DialogRef,
    config: DialogConfig
  ): void {
    const portal = new ComponentPortal(
      component,
      null,
      this.createInjector(dialogRef, config)
    );
    overlayRef.attach(portal);
  }

  private setupDialogBehaviors(dialogRef: DialogRef, config: DialogConfig): void {
    if (config.closeOnBackdropClick) {
      dialogRef.backdropClick().subscribe(() => dialogRef.close());
    }

    if (config.closeOnEsc) {
      dialogRef.keydownEvents().subscribe((event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          dialogRef.close();
        }
      });
    }

    dialogRef.afterClosed().subscribe(() => {
      const index = this.openDialogs.indexOf(dialogRef);
      if (index > -1) {
        this.openDialogs.splice(index, 1);
      }
    });
  }
}
