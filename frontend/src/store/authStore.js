import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TIER_FEATURES } from '../utils/tierFeatures';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: (user, accessToken, refreshToken) => 
        set({ user, accessToken, refreshToken }),
      clearAuth: () => 
        set({ user: null, accessToken: null, refreshToken: null }),
      hasFeature: (feature) => {
        const user = get().user;
        if (!user || !user.companyId) return false;

        const company = user.companyId;
        if (typeof company === 'string') {
          return TIER_FEATURES['starter'].includes(feature);
        }

        let effectiveTier = company.subscriptionTier || 'starter';
        if (company.subscriptionStatus === 'trial') {
          effectiveTier = 'growth';
        }

        const features = TIER_FEATURES[effectiveTier] || [];
        return features.includes(feature);
      }
    }),
    {
      name: 'trova-auth-storage', // Key name in local storage
    }
  )
);
