/* eslint-disable react-refresh/only-export-components */
/**
 * Profile Context
 * Manages user profiles and provides profile state across the application
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { persistence, type Profile, type Wallet, type WalletInput } from '../services/persistence'

interface ProfileContextType {
  // Profile state
  profiles: Profile[]
  currentProfile: Profile | null
  isLoading: boolean
  error: string | null

  // Profile actions
  createProfile: (name: string) => Promise<Profile>
  updateProfile: (id: string, name: string) => Promise<Profile>
  deleteProfile: (id: string) => Promise<void>
  setCurrentProfile: (profile: Profile | null) => void
  refreshProfiles: () => Promise<void>

  // Wallet state for current profile
  wallets: Wallet[]
  walletsLoading: boolean

  // Wallet actions
  addWallet: (wallet: Omit<WalletInput, 'profile_id'>) => Promise<Wallet>
  removeWallet: (id: string) => Promise<void>
  refreshWallets: () => Promise<void>
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined)

const CURRENT_PROFILE_KEY = 'currentProfileId'

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [currentProfile, setCurrentProfileState] = useState<Profile | null>(null)
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [walletsLoading, setWalletsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load profiles on mount
  const loadProfiles = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      let loadedProfiles = await persistence.getProfiles()

      // Auto-create default profile if none exists
      if (loadedProfiles.length === 0) {
        try {
          const defaultProfile = await persistence.createProfile('Default Profile')
          loadedProfiles = [defaultProfile]
        } catch (createErr) {
          console.error('[ProfileContext] Failed to create default profile:', createErr)
        }
      }

      setProfiles(loadedProfiles)

      // Restore current profile from settings
      const savedProfileId = await persistence.getSetting(CURRENT_PROFILE_KEY)
      if (savedProfileId) {
        const savedProfile = loadedProfiles.find((p) => p.id === savedProfileId)
        if (savedProfile) {
          setCurrentProfileState(savedProfile)
        } else if (loadedProfiles.length > 0) {
          // Saved profile no longer exists, use first available
          setCurrentProfileState(loadedProfiles[0])
        }
      } else if (loadedProfiles.length > 0) {
        // No saved profile, use first available
        setCurrentProfileState(loadedProfiles[0])
      }
    } catch (err) {
      console.error('[ProfileContext] Failed to load profiles:', err)
      setError(err instanceof Error ? err.message : 'Failed to load profiles')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load wallets when current profile changes
  const loadWallets = useCallback(async () => {
    if (!currentProfile) {
      setWallets([])
      return
    }

    try {
      setWalletsLoading(true)
      const loadedWallets = await persistence.getWallets(currentProfile.id)
      setWallets(loadedWallets)
    } catch (err) {
      console.error('[ProfileContext] Failed to load wallets:', err)
    } finally {
      setWalletsLoading(false)
    }
  }, [currentProfile])

  useEffect(() => {
    loadProfiles()
  }, [loadProfiles])

  useEffect(() => {
    loadWallets()
  }, [loadWallets])

  // Save current profile to settings when it changes
  useEffect(() => {
    if (currentProfile) {
      persistence.setSetting(CURRENT_PROFILE_KEY, currentProfile.id).catch((err) => {
        console.error('[ProfileContext] Failed to save current profile:', err)
      })
    }
  }, [currentProfile])

  const createProfile = useCallback(async (name: string): Promise<Profile> => {
    const newProfile = await persistence.createProfile(name)
    setProfiles((prev) => [newProfile, ...prev])
    return newProfile
  }, [])

  const updateProfile = useCallback(async (id: string, name: string): Promise<Profile> => {
    const updatedProfile = await persistence.updateProfile(id, name)
    setProfiles((prev) => prev.map((p) => (p.id === id ? updatedProfile : p)))

    // Update current profile if it was the one updated
    setCurrentProfileState((prev) => (prev?.id === id ? updatedProfile : prev))

    return updatedProfile
  }, [])

  const deleteProfile = useCallback(
    async (id: string): Promise<void> => {
      await persistence.deleteProfile(id)
      setProfiles((prev) => prev.filter((p) => p.id !== id))

      // If deleted profile was current, switch to another
      if (currentProfile?.id === id) {
        const remaining = profiles.filter((p) => p.id !== id)
        setCurrentProfileState(remaining.length > 0 ? remaining[0] : null)
      }
    },
    [currentProfile, profiles]
  )

  const setCurrentProfile = useCallback((profile: Profile | null) => {
    setCurrentProfileState(profile)
  }, [])

  const refreshProfiles = useCallback(async () => {
    await loadProfiles()
  }, [loadProfiles])

  const addWallet = useCallback(
    async (wallet: Omit<WalletInput, 'profile_id'>): Promise<Wallet> => {
      if (!currentProfile) {
        throw new Error('No profile selected')
      }

      const newWallet = await persistence.saveWallet({
        ...wallet,
        profile_id: currentProfile.id,
      })

      setWallets((prev) => [newWallet, ...prev.filter((w) => w.id !== newWallet.id)])
      return newWallet
    },
    [currentProfile]
  )

  const removeWallet = useCallback(async (id: string): Promise<void> => {
    await persistence.deleteWallet(id)
    setWallets((prev) => prev.filter((w) => w.id !== id))
  }, [])

  const refreshWallets = useCallback(async () => {
    await loadWallets()
  }, [loadWallets])

  return (
    <ProfileContext.Provider
      value={{
        profiles,
        currentProfile,
        isLoading,
        error,
        createProfile,
        updateProfile,
        deleteProfile,
        setCurrentProfile,
        refreshProfiles,
        wallets,
        walletsLoading,
        addWallet,
        removeWallet,
        refreshWallets,
      }}
    >
      {children}
    </ProfileContext.Provider>
  )
}

export const useProfile = () => {
  const context = useContext(ProfileContext)
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider')
  }
  return context
}
