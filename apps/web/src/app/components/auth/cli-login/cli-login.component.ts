import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormField, form, required } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { CliAuthService } from '@flashmind/api-client';
import { FmPageHeaderComponent, FmButtonComponent } from '@flashmind/ui';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-cli-login-panel',
  imports: [FormField, FmPageHeaderComponent, FmButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main
      class="mx-auto max-w-xl p-6 [&_button.bg-primary]:bg-sky-800 [&_button.bg-primary:hover]:bg-sky-900"
      data-testid="cli-login-page"
    >
      <fm-page-header title="CLI 登入授權" />
      @if (loading()) {
        <p role="status">正在確認登入帳號…</p>
      } @else if (!user()) {
        <p class="my-4">請先在另一個分頁登入 FlashMind，再回來重新整理這個頁面。</p>
        <a
          href="/login"
          target="_blank"
          rel="noopener"
          class="underline"
          data-testid="cli-login-sign-in"
          >開啟登入頁面</a
        >
      } @else if (finished()) {
        <p class="my-4" role="status" data-testid="cli-login-result">{{ finished() }}</p>
      } @else {
        <p class="my-4">
          目前帳號：<strong data-testid="cli-login-account">{{ user()?.email }}</strong>
        </p>
        <p class="my-4">
          只在你剛剛執行 flashmind login 時授權。CLI 將能讀取練習上下文，並以此帳號保存你確認的
          Review。
        </p>
        <label for="cli-pairing" class="block my-2">終端機顯示的配對碼</label>
        <input
          id="cli-pairing"
          data-testid="cli-login-code"
          class="w-full rounded-lg border p-3"
          autocomplete="off"
          spellcheck="false"
          [formField]="pairingForm.code"
        />
        <div class="my-6 flex gap-3">
          <fm-button
            testId="cli-login-approve"
            [disabled]="busy() || !model().code.trim()"
            (click)="decide('approve')"
            >授權此 CLI</fm-button
          >
          <fm-button
            testId="cli-login-deny"
            variant="secondary"
            [disabled]="busy() || !model().code.trim()"
            (click)="decide('deny')"
            >拒絕授權</fm-button
          >
        </div>
      }
      @if (error()) {
        <p role="alert" class="my-4 text-red-600" data-testid="cli-login-error">{{ error() }}</p>
      }
    </main>
  `,
})
export class CliLoginPanelComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly api = inject(CliAuthService);
  private readonly authorization =
    inject(ActivatedRoute).snapshot.queryParamMap.get('authorization');
  readonly user = this.auth.user;
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly finished = signal<string | null>(null);
  readonly model = signal({ code: '' });
  readonly pairingForm = form(this.model, (p) => required(p.code));

  async ngOnInit() {
    await firstValueFrom(this.auth.checkAuth());
    this.loading.set(false);
    if (!this.authorization) this.error.set('缺少授權識別，請重新執行 flashmind login。');
  }
  async decide(decision: 'approve' | 'deny') {
    if (this.busy() || !this.authorization || !this.user() || !this.model().code.trim()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.api.approveCliLoginAuthorization(this.authorization, {
          expectedUserId: this.user()!.id,
          pairingCode: this.model().code.trim().toUpperCase(),
          decision,
        }),
      );
      this.finished.set(decision === 'approve' ? '已授權，請回到終端機完成登入。' : '已拒絕授權。');
    } catch {
      this.error.set(
        '授權失敗，請核對配對碼與登入帳號。授權有效期為五分鐘，過期請重新執行 login。',
      );
    } finally {
      this.busy.set(false);
    }
  }
}
