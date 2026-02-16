import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guards/auth.guard';
import { unsavedChangesGuard } from './guards/unsaved-changes.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'welcome',
  },
  {
    path: 'welcome',
    loadComponent: () =>
      import('./pages/welcome/welcome.component').then((module) => module.WelcomeComponent),
    canActivate: [guestGuard],
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then((module) => module.LoginComponent),
    canActivate: [guestGuard],
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/register/register.component').then((module) => module.RegisterComponent),
    canActivate: [guestGuard],
  },
  {
    path: 'decks/new',
    loadComponent: () =>
      import('./pages/deck-create/deck-create.component').then(
        (module) => module.DeckCreateComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'home',
    loadComponent: () =>
      import('./pages/home/home.component').then((module) => module.HomeComponent),
    canActivate: [authGuard],
  },
  {
    path: 'decks/:id/settings',
    loadComponent: () =>
      import('./pages/deck-settings/deck-settings.component').then(
        (module) => module.DeckSettingsComponent,
      ),
    canActivate: [authGuard],
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'decks/:id',
    loadComponent: () =>
      import('./pages/deck-detail/deck-detail.component').then(
        (module) => module.DeckDetailComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'decks',
    loadComponent: () =>
      import('./pages/deck-list/deck-list.component').then((module) => module.DeckListComponent),
    canActivate: [authGuard],
  },
  {
    path: 'decks/:deckId/cards/import',
    loadComponent: () =>
      import('./pages/card-import/card-import.component').then(
        (module) => module.CardImportComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'decks/:deckId/cards/new',
    loadComponent: () =>
      import('./pages/card-editor/card-editor.component').then(
        (module) => module.CardEditorComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'decks/:deckId/cards/:cardId/edit',
    loadComponent: () =>
      import('./pages/card-editor/card-editor.component').then(
        (module) => module.CardEditorComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'decks/:deckId/study',
    loadComponent: () =>
      import('./pages/study/study.component').then((module) => module.StudyComponent),
    canActivate: [authGuard],
  },
  {
    path: 'settings/vocab',
    loadComponent: () =>
      import('./pages/settings/vocab/settings-vocab.component').then(
        (module) => module.SettingsVocabComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'settings/speaking',
    loadComponent: () =>
      import('./pages/settings/speaking/settings-speaking.component').then(
        (module) => module.SettingsSpeakingComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./pages/settings/settings.component').then((module) => module.SettingsComponent),
    canActivate: [authGuard],
  },
  {
    path: '**',
    redirectTo: 'welcome',
  },
];
