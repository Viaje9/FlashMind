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

    return this.prisma.card.findMany({
      where: {
        deck: { userId },
        ...(trimmedQuery
          ? {
              OR: [
                { front: { contains: trimmedQuery, mode: 'insensitive' } },
                {
                  meanings: {
                    some: {
                      zhMeaning: {
                        contains: trimmedQuery,
                        mode: 'insensitive',
                      },
                    },
                  },
                },
              ],
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
}
