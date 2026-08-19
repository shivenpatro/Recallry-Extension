import Fuse from 'fuse.js';
import type { Collection, LinkCard, SearchResult, SmartCollectionRule } from '../shared/types';
import { normalizeSearch } from '../shared/utils';

export function runGlobalSearch(query: string, collections: Collection[], links: LinkCard[]): SearchResult[] {
  const normalized = normalizeSearch(query);
  if (!normalized) return [];

  const collectionResults = new Fuse(collections, {
    keys: ['title', 'description'],
    threshold: 0.32,
    includeScore: true
  })
    .search(normalized)
    .map((result) => ({
      id: result.item.id,
      type: 'collection' as const,
      title: result.item.title,
      subtitle: result.item.description || 'Collection',
      score: result.score
    }));

  const linkResults = new Fuse(links, {
    keys: ['title', 'url', 'domain', 'notes', 'tags', 'labels'],
    threshold: 0.34,
    includeScore: true
  })
    .search(normalized)
    .map((result) => ({
      id: result.item.id,
      type: 'link' as const,
      title: result.item.title,
      subtitle: result.item.domain,
      score: result.score,
      collectionId: result.item.collectionId,
      url: result.item.url
    }));

  return [...collectionResults, ...linkResults].sort((a, b) => (a.score ?? 1) - (b.score ?? 1)).slice(0, 24);
}

export function matchesSmartRules(link: LinkCard, rules: SmartCollectionRule[] = []) {
  if (rules.length === 0) return false;
  return rules.every((rule) => {
    const fieldValue = link[rule.field];
    const value = Array.isArray(fieldValue) ? fieldValue.join(' ') : String(fieldValue ?? '');
    const normalizedField = normalizeSearch(value);
    const normalizedRule = normalizeSearch(rule.value);

    if (rule.operator === 'contains') return normalizedField.includes(normalizedRule);
    if (rule.operator === 'equals') return normalizedField === normalizedRule;
    if (rule.operator === 'startsWith') return normalizedField.startsWith(normalizedRule);

    const days = Number(rule.value);
    const createdAt = new Date(link.createdAt).getTime();
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    if (rule.operator === 'olderThanDays') return createdAt < cutoff;
    if (rule.operator === 'newerThanDays') return createdAt >= cutoff;
    return false;
  });
}

export function filterLinks(links: LinkCard[], query: string, selectedTags: string[]) {
  const normalized = normalizeSearch(query);
  return links.filter((link) => {
    const tagMatch = selectedTags.length === 0 || selectedTags.every((tag) => link.tags.includes(tag));
    if (!tagMatch) return false;
    if (!normalized) return true;
    return [link.title, link.url, link.domain, link.notes, link.tags.join(' '), link.labels.join(' ')]
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalized);
  });
}
