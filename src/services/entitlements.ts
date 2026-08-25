export type PlanId = 'free' | 'pro';

export type FeatureId =
  | 'localCollections'
  | 'vault'
  | 'trashAndRestore'
  | 'manualBackups'
  | 'offlineSnapshots'
  | 'encryptedSync'
  | 'cloudBackup'
  | 'sharedWorkspaces';

export const FEATURE_CATALOG: Record<FeatureId, { suggestedTier: PlanId; available: boolean }> = {
  localCollections: { suggestedTier: 'free', available: true },
  vault: { suggestedTier: 'free', available: true },
  trashAndRestore: { suggestedTier: 'free', available: true },
  manualBackups: { suggestedTier: 'free', available: true },
  offlineSnapshots: { suggestedTier: 'free', available: true },
  encryptedSync: { suggestedTier: 'pro', available: false },
  cloudBackup: { suggestedTier: 'pro', available: false },
  sharedWorkspaces: { suggestedTier: 'pro', available: false }
};

export function canUseFeature(plan: PlanId, feature: FeatureId) {
  const definition = FEATURE_CATALOG[feature];
  return definition.available && (definition.suggestedTier === 'free' || plan === 'pro');
}
