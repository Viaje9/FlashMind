import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { merge } from 'rxjs';
import {
  FmButtonComponent,
  FmPageHeaderComponent,
  FmSectionHeadingComponent,
  FmSettingRowComponent,
} from '@flashmind/ui';

interface SpeakingSettings {
  autoPlayVoice: boolean;
  showTranscript: boolean;
  autoTranslate: boolean;
}

const STORAGE_KEY = 'flashmind.settings.speaking';
const DEFAULT_SETTINGS: SpeakingSettings = {
  autoPlayVoice: true,
  showTranscript: true,
  autoTranslate: false,
};

function loadSettings(): SpeakingSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<SpeakingSettings>;
    return {
      autoPlayVoice: parsed.autoPlayVoice ?? DEFAULT_SETTINGS.autoPlayVoice,
      showTranscript: parsed.showTranscript ?? DEFAULT_SETTINGS.showTranscript,
      autoTranslate: parsed.autoTranslate ?? DEFAULT_SETTINGS.autoTranslate,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

@Component({
  selector: 'app-settings-speaking-page',
  imports: [
    FmPageHeaderComponent,
    FmButtonComponent,
    FmSectionHeadingComponent,
    FmSettingRowComponent,
    RouterLink,
    ReactiveFormsModule,
  ],
  templateUrl: './settings-speaking.component.html',
  styleUrl: './settings-speaking.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsSpeakingComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly autoPlayVoiceControl = new FormControl(true, { nonNullable: true });
  readonly showTranscriptControl = new FormControl(true, { nonNullable: true });
  readonly autoTranslateControl = new FormControl(false, { nonNullable: true });

  ngOnInit() {
    const settings = loadSettings();
    this.autoPlayVoiceControl.setValue(settings.autoPlayVoice, { emitEvent: false });
    this.showTranscriptControl.setValue(settings.showTranscript, { emitEvent: false });
    this.autoTranslateControl.setValue(settings.autoTranslate, { emitEvent: false });

    merge(
      this.autoPlayVoiceControl.valueChanges,
      this.showTranscriptControl.valueChanges,
      this.autoTranslateControl.valueChanges,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            autoPlayVoice: this.autoPlayVoiceControl.value,
            showTranscript: this.showTranscriptControl.value,
            autoTranslate: this.autoTranslateControl.value,
          } satisfies SpeakingSettings),
        );
      });
  }
}
