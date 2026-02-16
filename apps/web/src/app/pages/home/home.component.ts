import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FmIconButtonComponent, FmPageHeaderComponent } from '@flashmind/ui';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink, FmPageHeaderComponent, FmIconButtonComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {}
