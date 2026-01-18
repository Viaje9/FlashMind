export * from './auth.service';
import { AuthService } from './auth.service';
export * from './cards.service';
import { CardsService } from './cards.service';
export * from './decks.service';
import { DecksService } from './decks.service';
export const APIS = [AuthService, CardsService, DecksService];
