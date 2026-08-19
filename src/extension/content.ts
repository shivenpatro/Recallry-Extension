import { captureFromDocument } from '../services/capture';
import type { RuntimeMessage } from '../shared/types';

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type !== 'LINKSCAPE_CAPTURE_PAGE') return false;
  try {
    sendResponse({ ok: true, capture: captureFromDocument() });
  } catch (error) {
    sendResponse({ ok: false, error: error instanceof Error ? error.message : 'Page capture failed' });
  }
  return true;
});
