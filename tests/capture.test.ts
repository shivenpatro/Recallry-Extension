import { afterEach, describe, expect, it } from 'vitest';
import { captureFromDocument } from '../src/services/capture';

describe('page capture', () => {
  afterEach(() => {
    document.head.innerHTML = '';
  });

  it('resolves relative preview images against the page URL', () => {
    window.history.replaceState({}, '', '/articles/linkscape');
    document.title = 'Linkscape article';
    document.head.insertAdjacentHTML('beforeend', '<meta property="og:image" content="/images/preview.png">');
    expect(captureFromDocument().thumbnailUrl).toBe(`${window.location.origin}/images/preview.png`);
  });
});
