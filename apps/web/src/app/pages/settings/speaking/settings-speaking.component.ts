import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SpeakingService as SpeakingApiService, SpeakingVoice } from '@flashmind/api-client';
import { merge } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import {
  FmButtonComponent,
  FmPageHeaderComponent,
  FmSectionHeadingComponent,
  FmSettingRowComponent,
} from '@flashmind/ui';
import { base64ToBlob } from '../../../components/speaking/speaking-audio.utils';
import {
  SPEAKING_DEFAULT_SETTINGS,
  type SpeakingSettings,
} from '../../../components/speaking/speaking.domain';
import { SpeakingRepository } from '../../../components/speaking/speaking.repository';
import { type HasUnsavedChanges } from '../../../guards/unsaved-changes.guard';

@Component({
  selector: 'app-settings-speaking-page',
  imports: [
    FmPageHeaderComponent,
    FmButtonComponent,
    FmSectionHeadingComponent,
    FmSettingRowComponent,
    ReactiveFormsModule,
  ],
  templateUrl: './settings-speaking.component.html',
  styleUrl: './settings-speaking.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsSpeakingComponent implements OnInit, HasUnsavedChanges {
  private readonly destroyRef = inject(DestroyRef);
  private readonly repository = inject(SpeakingRepository);
  private readonly speakingApi = inject(SpeakingApiService);
  private readonly router = inject(Router);

  readonly voiceOptions: ReadonlyArray<{ label: string; value: SpeakingVoice }> = [
    { label: 'Nova', value: SpeakingVoice.Nova },
    { label: 'Alloy', value: SpeakingVoice.Alloy },
    { label: 'Ash', value: SpeakingVoice.Ash },
    { label: 'Ballad', value: SpeakingVoice.Ballad },
    { label: 'Coral', value: SpeakingVoice.Coral },
    { label: 'Echo', value: SpeakingVoice.Echo },
    { label: 'Fable', value: SpeakingVoice.Fable },
    { label: 'Onyx', value: SpeakingVoice.Onyx },
    { label: 'Sage', value: SpeakingVoice.Sage },
    { label: 'Shimmer', value: SpeakingVoice.Shimmer },
  ];

  readonly autoPlayVoiceControl = new FormControl(true, { nonNullable: true });
  readonly showTranscriptControl = new FormControl(true, { nonNullable: true });
  readonly autoTranslateControl = new FormControl(false, { nonNullable: true });
  readonly autoMemoryEnabledControl = new FormControl(true, { nonNullable: true });
  readonly systemPromptControl = new FormControl('', { nonNullable: true });
  readonly memoryControl = new FormControl('', { nonNullable: true });
  readonly voiceControl = new FormControl<SpeakingVoice>(SpeakingVoice.Nova, { nonNullable: true });

  readonly previewLoading = signal(false);
  readonly previewError = signal<string | null>(null);
  readonly discardModalOpen = signal(false);

  private readonly initialSettings = signal<SpeakingSettings | null>(null);
  private readonly formRevision = signal(0);
  private readonly bypassUnsavedPromptOnce = signal(false);

  readonly hasUnsavedChanges = computed(() => {
    this.formRevision();

    const initial = this.initialSettings();
    if (!initial) {
      return false;
    }

    const current = this.getCurrentSettings();
    return !this.isSameSettings(initial, current);
  });

  ngOnInit(): void {
    const settings = this.repository.loadSettings();
    this.initialSettings.set(settings);
    this.applySettingsToForm(settings);

    merge(
      this.autoPlayVoiceControl.valueChanges,
      this.showTranscriptControl.valueChanges,
      this.autoTranslateControl.valueChanges,
      this.autoMemoryEnabledControl.valueChanges,
      this.systemPromptControl.valueChanges,
      this.memoryControl.valueChanges,
      this.voiceControl.valueChanges,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.formRevision.update((revision) => revision + 1);
      });
  }

  async onBack(): Promise<void> {
    if (!this.hasUnsavedChanges()) {
      await this.router.navigate(['/settings']);
      return;
    }

    this.discardModalOpen.set(true);
  }

  async onSave(): Promise<void> {
    const next = this.getCurrentSettings();
    this.repository.saveSettings(next);
    this.initialSettings.set(next);
    this.formRevision.update((revision) => revision + 1);
    await this.router.navigate(['/settings']);
  }

  onResetDraft(): void {
    this.applySettingsToForm(SPEAKING_DEFAULT_SETTINGS);
    this.formRevision.update((revision) => revision + 1);
  }

  onCancelDiscard(): void {
    this.discardModalOpen.set(false);
  }

  async onConfirmDiscard(): Promise<void> {
    this.discardModalOpen.set(false);
    this.bypassUnsavedPromptOnce.set(true);
    const navigated = await this.router.navigate(['/settings']);
    if (!navigated) {
      this.bypassUnsavedPromptOnce.set(false);
    }
  }

  async onPreviewVoice(): Promise<void> {
    this.previewError.set(null);
    this.previewLoading.set(true);

    try {
      const response = await firstValueFrom(
        this.speakingApi.previewSpeakingVoice({
          voice: this.voiceControl.value,
        }),
      );

      const blob = base64ToBlob(response.data.audioBase64);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);

      try {
        await audio.play();
        await new Promise<void>((resolve) => {
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
        });
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      this.previewError.set('語音試聽失敗，請稍後再試。');
    } finally {
      this.previewLoading.set(false);
    }
  }

  canDeactivate(): boolean {
    if (this.bypassUnsavedPromptOnce()) {
      return true;
    }

    if (!this.hasUnsavedChanges()) {
      return true;
    }

    return window.confirm('你有未儲存的口說設定，確定要離開嗎？');
  }

  private applySettingsToForm(settings: SpeakingSettings): void {
    this.autoPlayVoiceControl.setValue(settings.autoPlayVoice, { emitEvent: false });
    this.showTranscriptControl.setValue(settings.showTranscript, { emitEvent: false });
    this.autoTranslateControl.setValue(settings.autoTranslate, { emitEvent: false });
    this.autoMemoryEnabledControl.setValue(settings.autoMemoryEnabled, { emitEvent: false });
    this.systemPromptControl.setValue(settings.systemPrompt, { emitEvent: false });
    this.memoryControl.setValue(settings.memory, { emitEvent: false });
    this.voiceControl.setValue(settings.voice, { emitEvent: false });
  }

  private getCurrentSettings(): SpeakingSettings {
    return {
      autoPlayVoice: this.autoPlayVoiceControl.value,
      showTranscript: this.showTranscriptControl.value,
      autoTranslate: this.autoTranslateControl.value,
      autoMemoryEnabled: this.autoMemoryEnabledControl.value,
      systemPrompt: this.systemPromptControl.value,
      memory: this.memoryControl.value,
      voice: this.voiceControl.value,
    };
  }

  private isSameSettings(left: SpeakingSettings, right: SpeakingSettings): boolean {
    return (
      left.autoPlayVoice === right.autoPlayVoice &&
      left.showTranscript === right.showTranscript &&
      left.autoTranslate === right.autoTranslate &&
      left.autoMemoryEnabled === right.autoMemoryEnabled &&
      left.systemPrompt === right.systemPrompt &&
      left.memory === right.memory &&
      left.voice === right.voice
    );
  }
}
