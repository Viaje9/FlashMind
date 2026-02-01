import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// 攔截 iOS Safari / PWA 螢幕邊緣滑動返回手勢 (iOS 13.4+)
// 使用 clientX（螢幕座標）而非 pageX（含捲動偏移），確保邊緣偵測不受頁面捲動影響
const EDGE_THRESHOLD = 44;
let isEdgeTouch = false;

document.addEventListener(
  'touchstart',
  (e: TouchEvent) => {
    const x = e.touches[0]?.clientX ?? 0;
    isEdgeTouch = x <= EDGE_THRESHOLD || x >= window.innerWidth - EDGE_THRESHOLD;
    if (isEdgeTouch) {
      e.preventDefault();
    }
  },
  { passive: false },
);

// touchmove 也需攔截，避免 iOS Safari 在移動階段才接管手勢
document.addEventListener(
  'touchmove',
  (e: TouchEvent) => {
    if (isEdgeTouch) {
      e.preventDefault();
    }
  },
  { passive: false },
);

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
