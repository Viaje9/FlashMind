export interface DialogConfig<D = any> {
  /** 對話框位置 */
  position?: 'center' | 'top' | 'bottom';

  /** 最小寬度 */
  minWidth?: string;

  /** 最大寬度 */
  maxWidth?: string;

  /** 最小高度 */
  minHeight?: string;

  /** 最大高度 */
  maxHeight?: string;

  /** 是否顯示背景遮罩 */
  hasBackdrop?: boolean;

  /** 點擊背景遮罩是否關閉 */
  closeOnBackdropClick?: boolean;

  /** 按 ESC 鍵是否關閉 */
  closeOnEsc?: boolean;

  /** 傳遞給對話框的資料 */
  data?: D;

  /** 自訂 CSS 類別 */
  panelClass?: string | string[];

  /** 對話框的 aria-label */
  ariaLabel?: string;

  /** 對話框的 aria-describedby */
  ariaDescribedBy?: string;
}

export const DEFAULT_DIALOG_CONFIG: DialogConfig = {
  position: 'center',
  maxWidth: '90vw',
  hasBackdrop: true,
  closeOnBackdropClick: true,
  closeOnEsc: true,
  panelClass: '',
};
