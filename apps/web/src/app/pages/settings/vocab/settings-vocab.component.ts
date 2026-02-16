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

interface VocabSettings {
  dailyReminder: boolean;
  spacedRepetition: boolean;
  smartShuffle: boolean;
}

const STORAGE_KEY = 'flashmind.settings.vocab';
const DEFAULT_SETTINGS: VocabSettings = {
  dailyReminder: true,
  spacedRepetition: true,
  smartShuffle: false,
};

function loadSettings(): VocabSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<VocabSettings>;
    return {
      dailyReminder: parsed.dailyReminder ?? DEFAULT_SETTINGS.dailyReminder,
      spacedRepetition: parsed.spacedRepetition ?? DEFAULT_SETTINGS.spacedRepetition,
      smartShuffle: parsed.smartShuffle ?? DEFAULT_SETTINGS.smartShuffle,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

@Component({
  selector: 'app-settings-vocab-page',
  imports: [
    FmPageHeaderComponent,
    FmButtonComponent,
    FmSectionHeadingComponent,
    FmSettingRowComponent,
    RouterLink,
    ReactiveFormsModule,
  ],
  templateUrl: './settings-vocab.component.html',
  styleUrl: './settings-vocab.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsVocabComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly dailyReminderControl = new FormControl(true, { nonNullable: true });
  readonly spacedRepetitionControl = new FormControl(true, { nonNullable: true });
  readonly smartShuffleControl = new FormControl(false, { nonNullable: true });

  ngOnInit() {
    const settings = loadSettings();
    this.dailyReminderControl.setValue(settings.dailyReminder, { emitEvent: false });
    this.spacedRepetitionControl.setValue(settings.spacedRepetition, { emitEvent: false });
    this.smartShuffleControl.setValue(settings.smartShuffle, { emitEvent: false });

    merge(
      this.dailyReminderControl.valueChanges,
      this.spacedRepetitionControl.valueChanges,
      this.smartShuffleControl.valueChanges,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            dailyReminder: this.dailyReminderControl.value,
            spacedRepetition: this.spacedRepetitionControl.value,
            smartShuffle: this.smartShuffleControl.value,
          } satisfies VocabSettings),
        );
      });
  }
}
