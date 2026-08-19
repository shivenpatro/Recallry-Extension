import { describe, expect, it } from 'vitest';
import { runGlobalSearch, matchesSmartRules } from '../src/services/search';
import type { Collection, LinkCard } from '../src/shared/types';

const collection: Collection = {
  id: 'ai',
  title: 'AI Research',
  description: 'Model papers and product notes',
  icon: 'Atom',
  theme: 'aurora',
  order: 0,
  isPinned: false,
  isFavorite: false,
  isVaultProtected: false,
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
};

const link: LinkCard = {
  id: 'link_1',
  collectionId: 'ai',
  title: 'Transformer paper',
  url: 'https://example.com/attention',
  domain: 'example.com',
  notes: 'Attention mechanisms',
  tags: ['research', 'ai'],
  labels: [],
  order: 0,
  isArchived: false,
  isVaultProtected: false,
  createdAt: '2026-01-02T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z'
};

describe('search service', () => {
  it('searches collections and links together', () => {
    const results = runGlobalSearch('attention', [collection], [link]);
    expect(results[0]).toMatchObject({ id: 'link_1', type: 'link' });
  });

  it('matches smart collection tag rules', () => {
    expect(
      matchesSmartRules(link, [
        {
          id: 'rule_1',
          field: 'tags',
          operator: 'contains',
          value: 'research'
        }
      ])
    ).toBe(true);
  });
});
