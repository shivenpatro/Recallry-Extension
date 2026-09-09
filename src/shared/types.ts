export type CollectionStatus = 'active' | 'archived' | 'trashed';

export type ThemeName =
  | 'aurora'
  | 'ember'
  | 'forest'
  | 'glacier'
  | 'grape'
  | 'mono'
  | 'sunset';

export type SmartRuleOperator = 'contains' | 'equals' | 'startsWith' | 'olderThanDays' | 'newerThanDays';

export interface SmartCollectionRule {
  id: string;
  field: 'title' | 'url' | 'domain' | 'notes' | 'tags' | 'createdAt';
  operator: SmartRuleOperator;
  value: string;
}

export interface Collection {
  id: string;
  title: string;
  description: string;
  icon: string;
  theme: ThemeName;
  parentId?: string;
  order: number;
  isPinned: boolean;
  isFavorite: boolean;
  isVaultProtected: boolean;
  status: CollectionStatus;
  smartRules?: SmartCollectionRule[];
  encryptedMetadata?: EncryptedPayload;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LinkCard {
  id: string;
  collectionId: string;
  title: string;
  url: string;
  domain: string;
  faviconUrl?: string;
  thumbnailUrl?: string;
  snapshotHtml?: string;
  snapshotCapturedAt?: string;
  notes: string;
  tags: string[];
  labels: string[];
  order: number;
  isArchived: boolean;
  isVaultProtected: boolean;
  encryptedPayload?: EncryptedPayload;
  deletedAt?: string;
  deletedWithCollectionId?: string;
  healthStatus?: 'healthy' | 'broken' | 'unknown';
  healthCheckedAt?: string;
  healthHttpStatus?: number;
  createdAt: string;
  updatedAt: string;
}

export interface LinkCapture {
  title: string;
  url: string;
  domain: string;
  faviconUrl?: string;
  thumbnailUrl?: string;
  snapshotHtml?: string;
  snapshotCapturedAt?: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface EncryptedPayload {
  iv: string;
  salt: string;
  data: string;
}

export interface VaultSettings {
  enabled: boolean;
  passwordHash?: string;
  passwordKdf?: 'sha256' | 'pbkdf2';
  salt?: string;
  iterations: number;
  autoLockMinutes: number;
  version?: 2;
  recoveryQuestion?: string;
  recoverySalt?: string;
  recoveryAnswerHash?: string;
  recoveryKdf?: 'sha256' | 'pbkdf2';
  passwordWrappedKey?: EncryptedPayload;
  recoveryWrappedKey?: EncryptedPayload;
  lockedAt?: string;
  updatedAt: string;
}

export interface BackupEnvelope {
  version: number;
  exportedAt: string;
  collections: Collection[];
  links: LinkCard[];
  tags: Tag[];
  vault: VaultSettings;
}

export interface SearchResult {
  id: string;
  type: 'collection' | 'link';
  title: string;
  subtitle: string;
  score?: number;
  collectionId?: string;
  url?: string;
}

export interface RuntimeMessage<TPayload = unknown> {
  type:
    | 'RECALLRY_CAPTURE_PAGE'
    | 'RECALLRY_SAVE_ACTIVE_TAB'
    | 'RECALLRY_OPEN_DASHBOARD'
    | 'RECALLRY_OPEN_SEARCH'
    | 'RECALLRY_LOCK_VAULT'
    | 'RECALLRY_VAULT_LOCKED'
    | 'RECALLRY_REFRESH_CONTEXT_MENUS';
  payload?: TPayload;
}
