import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  FmButtonComponent,
  FmPageHeaderComponent,
  FmProfileCardComponent,
  FmSectionHeadingComponent,
  FmSettingRowComponent
} from '../../../../../../packages/ui/src/index';

@Component({
  selector: 'app-settings-page',
  imports: [
    FmPageHeaderComponent,
    FmButtonComponent,
    FmProfileCardComponent,
    FmSectionHeadingComponent,
    FmSettingRowComponent,
    RouterLink
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsComponent {}
