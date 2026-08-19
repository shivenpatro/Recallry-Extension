export type CollectionStatus = 'active' | 'archived';

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
  notes: string;
  tags: string[];
  labels: string[];
  order: number;
  isArchived: boolean;
  isVaultProtected: boolean;
  encryptedPayload?: EncryptedPayload;
  createdAt: string;
  updatedAt: string;
}

export interface LinkCapture {
  title: string;
  url: string;
  domain: string;
  faviconUrl?: string;
  thumbnailUrl?: string;
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
    | 'LINKSCAPE_CAPTURE_PAGE'
    | 'LINKSCAPE_SAVE_ACTIVE_TAB'
    | 'LINKSCAPE_OPEN_DASHBOARD'
    | 'LINKSCAPE_OPEN_SEARCH'
    | 'LINKSCAPE_LOCK_VAULT'
    | 'LINKSCAPE_VAULT_LOCKED';
  payload?: TPayload;
}
