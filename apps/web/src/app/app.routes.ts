import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'welcome'
  },
  {
    path: 'welcome',
    loadComponent: () =>
      import('./pages/welcome/welcome.component').then((module) => module.WelcomeComponent)
  },
  {
    path: 'decks/new',
    loadComponent: () =>
      import('./pages/deck-create/deck-create.component').then((module) => module.DeckCreateComponent)
  },
  {
    path: 'decks/:id',
    loadComponent: () =>
      import('./pages/deck-detail/deck-detail.component').then((module) => module.DeckDetailComponent)
  },
  {
    path: 'decks',
    loadComponent: () =>
      import('./pages/deck-list/deck-list.component').then((module) => module.DeckListComponent)
  },
  {
    path: 'cards/new',
    loadComponent: () =>
      import('./pages/card-editor/card-editor.component').then((module) => module.CardEditorComponent)
  },
  {
    path: 'study',
    loadComponent: () => import('./pages/study/study.component').then((module) => module.StudyComponent)
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./pages/settings/settings.component').then((module) => module.SettingsComponent)
  },
  {
    path: '**',
    redirectTo: 'welcome'
  }
];
