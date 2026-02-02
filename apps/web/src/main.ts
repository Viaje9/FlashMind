import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// 攔截 iOS Safari / PWA 螢幕邊緣滑動返回手勢 (iOS 13.4+)
const EDGE_THRESHOLD = 20;
document.addEventListener(
  'touchstart',
  (e: TouchEvent) => {
    const x = e.touches[0]?.pageX ?? 0;
    if (x <= EDGE_THRESHOLD || x >= window.innerWidth - EDGE_THRESHOLD) {
      e.preventDefault();
    }
  },
  { passive: false },
);

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
