import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CollectionToolService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserVocabularySummary(userId: string, limit = 20) {
    const [totalCards, sampleCards] = await Promise.all([
      this.prisma.card.count({
        where: {
          deck: { userId },
        },
      }),
      this.searchUserCards(userId, '', limit),
    ]);

    return {
      totalCards,
      sampleCards,
    };
  }

  async listUserCards(userId: string, limit = 80) {
    return this.prisma.card.findMany({
      where: {
        deck: { userId },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        meanings: {
          orderBy: { sortOrder: 'asc' },
          take: 1,
        },
      },
    });
  }

  async searchUserCards(userId: string, query: string, limit = 20) {
    const trimmedQuery = query.trim();
    const searchTerms = this.buildCardSearchTerms(trimmedQuery);

    return this.prisma.card.findMany({
      where: {
        deck: { userId },
        ...(searchTerms.length > 0
          ? {
              OR: searchTerms.flatMap((term) => [
                { front: { contains: term, mode: 'insensitive' as const } },
                {
                  meanings: {
                    some: {
                      zhMeaning: {
                        contains: term,
                        mode: 'insensitive' as const,
                      },
                    },
                  },
                },
              ]),
            }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        meanings: {
          orderBy: { sortOrder: 'asc' },
          take: 1,
        },
      },
    });
  }

  async findUserCardsByCandidateTexts(
    userId: string,
    texts: string[],
    limit = 120,
  ) {
    const terms = [
      ...new Set(texts.flatMap((text) => this.extractEnglishCardTerms(text))),
    ];

    if (terms.length === 0) {
      return [];
    }

    return this.prisma.card.findMany({
      where: {
        deck: { userId },
        OR: terms.map((term) => ({
          front: { equals: term, mode: 'insensitive' as const },
        })),
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        meanings: {
          orderBy: { sortOrder: 'asc' },
          take: 1,
        },
      },
    });
  }

  async searchCollectionItems(userId: string, query: string, limit = 20) {
    const trimmedQuery = query.trim();

    return this.prisma.collectionItem.findMany({
      where: {
        userId,
        ...(trimmedQuery
          ? {
              OR: [
                { text: { contains: trimmedQuery, mode: 'insensitive' } },
                { zhMeaning: { contains: trimmedQuery, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        cardLinks: {
          include: {
            card: {
              include: {
                meanings: {
                  orderBy: { sortOrder: 'asc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });
  }

  async findCollectionItemsByText(userId: string, texts: string[]) {
    const normalizedTexts = texts
      .map((text) => this.normalizeText(text))
      .filter((text) => text.length > 0);

    if (normalizedTexts.length === 0) {
      return [];
    }

    return this.prisma.collectionItem.findMany({
      where: {
        userId,
        normalizedText: { in: normalizedTexts },
      },
      select: {
        id: true,
        kind: true,
        text: true,
        normalizedText: true,
      },
    });
  }

  normalizeText(text: string): string {
    return text
      .normalize('NFKC')
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  private buildCardSearchTerms(query: string): string[] {
    if (!query) {
      return [];
    }

    return [
      ...new Set([
        query,
        ...this.extractEnglishCardTerms(query),
        ...this.extractCjkBigrams(query),
      ]),
    ].slice(0, 60);
  }

  private extractEnglishCardTerms(text: string): string[] {
    const stopWords = new Set([
      'a',
      'an',
      'and',
      'are',
      'before',
      'for',
      'i',
      'in',
      'is',
      'it',
      'of',
      'on',
      'or',
      'the',
      'to',
      'we',
      'you',
    ]);
    const terms: string[] = [];
    const words = text.toLowerCase().match(/[a-z][a-z'-]*/g) ?? [];

    for (const word of words) {
      const normalized = word.replace(/^'+|'+$/g, '');
      if (normalized.length < 2 || stopWords.has(normalized)) continue;

      terms.push(normalized);
      if (normalized.endsWith('ies') && normalized.length > 4) {
        terms.push(`${normalized.slice(0, -3)}y`);
      } else if (
        /(ses|xes|zes|ches|shes|oes)$/.test(normalized) &&
        normalized.length > 3
      ) {
        terms.push(normalized.slice(0, -2));
      } else if (normalized.endsWith('s') && normalized.length > 3) {
        terms.push(normalized.slice(0, -1));
      }
    }

    return terms;
  }

  private extractCjkBigrams(text: string): string[] {
    const cjkText = text.replace(/[^\u3400-\u9fff]/g, '');
    if (cjkText.length < 2) {
      return [];
    }

    const terms: string[] = [];
    for (let index = 0; index < cjkText.length - 1; index += 1) {
      terms.push(cjkText.slice(index, index + 2));
    }

    return terms;
  }
}
