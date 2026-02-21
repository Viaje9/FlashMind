import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FmIconButtonComponent, FmPageHeaderComponent } from '@flashmind/ui';
import { HomeEntryPreferenceService } from '../../services/home-entry-preference.service';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink, FmPageHeaderComponent, FmIconButtonComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  private readonly router = inject(Router);
  private readonly homeEntryPreferenceService = inject(HomeEntryPreferenceService);

  onEntryClick(path: '/decks' | '/speaking'): void {
    this.homeEntryPreferenceService.save(path);
    void this.router.navigate([path]);
  }
}
