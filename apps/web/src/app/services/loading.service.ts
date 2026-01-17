import { Injectable, ApplicationRef, EnvironmentInjector, signal, computed, inject } from '@angular/core';
import { ComponentPortal, DomPortalOutlet } from '@angular/cdk/portal';
import { LoadingOverlayComponent } from '../components/shared/loading-overlay/loading-overlay.component';

@Injectable({
  providedIn: 'root',
})
export class LoadingService {
  private readonly appRef = inject(ApplicationRef);
  private readonly environmentInjector = inject(EnvironmentInjector);

  private portalOutlet: DomPortalOutlet | null = null;
  private _activeRequests = signal(0);

  readonly loading = computed(() => this._activeRequests() > 0);

  show(): void {
    this._activeRequests.update((count) => count + 1);
    this.attachOverlay();
  }

  hide(): void {
    this._activeRequests.update((count) => Math.max(0, count - 1));

    if (this._activeRequests() === 0) {
      this.detachOverlay();
    }
  }

  reset(): void {
    this._activeRequests.set(0);
    this.detachOverlay();
  }

  private attachOverlay(): void {
    if (!this.portalOutlet) {
      this.portalOutlet = new DomPortalOutlet(
        document.body,
        this.appRef,
        this.environmentInjector,
      );
    }

    if (!this.portalOutlet.hasAttached()) {
      const portal = new ComponentPortal(LoadingOverlayComponent);
      this.portalOutlet.attach(portal);
    }
  }

  private detachOverlay(): void {
    if (this.portalOutlet?.hasAttached()) {
      this.portalOutlet.detach();
    }
  }
}
