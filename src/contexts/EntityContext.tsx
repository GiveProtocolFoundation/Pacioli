/* eslint-disable react-refresh/only-export-components */
/**
 * Entity Context
 * Manages entities (vendors, customers, counterparties) for the current profile
 * Provides entity state and actions across the application
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react'
import {
  persistence,
  type Entity,
  type EntityInput,
  type EntityUpdate,
  type EntityFilter,
  type EntityAddress,
  type EntityAddressInput,
  type AddressMatch,
  type KnownAddress,
} from '../services/persistence'
import { useProfile } from './ProfileContext'

interface EntityContextType {
  // Entity state
  entities: Entity[]
  isLoading: boolean
  error: string | null

  // Entity actions
  createEntity: (entity: Omit<EntityInput, 'profile_id'>) => Promise<Entity>
  updateEntity: (id: string, update: EntityUpdate) => Promise<Entity>
  deleteEntity: (id: string) => Promise<void>
  refreshEntities: () => Promise<void>

  // Entity filtering
  getFilteredEntities: (filter?: EntityFilter) => Entity[]
  searchEntities: (query: string, limit?: number) => Promise<Entity[]>

  // Entity address state and actions
  getEntityAddresses: (entityId: string) => Promise<EntityAddress[]>
  addEntityAddress: (
    address: Omit<EntityAddressInput, 'entity_id'>,
    entityId: string
  ) => Promise<EntityAddress>
  removeEntityAddress: (id: string) => Promise<void>

  // Address detection
  lookupAddress: (
    address: string,
    chain: string
  ) => Promise<AddressMatch | null>
  batchLookupAddresses: (
    addresses: Array<[string, string]>
  ) => Promise<AddressMatch[]>
  findEntityByAddress: (
    address: string,
    chain?: string
  ) => Promise<Entity | null>

  // Known addresses
  knownAddresses: KnownAddress[]
  knownAddressesLoading: boolean
  getKnownAddresses: (
    chain?: string,
    entityType?: string
  ) => Promise<KnownAddress[]>
  createEntityFromKnown: (address: string, chain: string) => Promise<Entity>
}

const EntityContext = createContext<EntityContextType | undefined>(undefined)

export const EntityProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { currentProfile } = useProfile()

  const [entities, setEntities] = useState<Entity[]>([])
  const [knownAddresses, setKnownAddresses] = useState<KnownAddress[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [knownAddressesLoading, setKnownAddressesLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load entities when profile changes
  const loadEntities = useCallback(async () => {
    if (!currentProfile) {
      setEntities([])
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      const loadedEntities = await persistence.getEntities(currentProfile.id)
      setEntities(loadedEntities)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load entities')
    } finally {
      setIsLoading(false)
    }
  }, [currentProfile])

  // Load known addresses on mount
  const loadKnownAddresses = useCallback(async () => {
    try {
      setKnownAddressesLoading(true)
      const loaded = await persistence.getKnownAddresses()
      setKnownAddresses(loaded)
    } catch {
      // Known addresses are optional, don't set error
    } finally {
      setKnownAddressesLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEntities()
  }, [loadEntities])

  useEffect(() => {
    loadKnownAddresses()
  }, [loadKnownAddresses])

  // Entity CRUD operations
  const createEntity = useCallback(
    async (entity: Omit<EntityInput, 'profile_id'>): Promise<Entity> => {
      if (!currentProfile) {
        throw new Error('No profile selected')
      }

      const newEntity = await persistence.createEntity({
        ...entity,
        profile_id: currentProfile.id,
      })

      setEntities(prev =>
        [...prev, newEntity].sort((a, b) => a.name.localeCompare(b.name))
      )
      return newEntity
    },
    [currentProfile]
  )

  const updateEntity = useCallback(
    async (id: string, update: EntityUpdate): Promise<Entity> => {
      const updatedEntity = await persistence.updateEntity(id, update)
      setEntities(prev =>
        prev
          .map(e => (e.id === id ? updatedEntity : e))
          .sort((a, b) => a.name.localeCompare(b.name))
      )
      return updatedEntity
    },
    []
  )

  const deleteEntity = useCallback(async (id: string): Promise<void> => {
    await persistence.deleteEntity(id)
    setEntities(prev => prev.filter(e => e.id !== id))
  }, [])

  const refreshEntities = useCallback(async () => {
    await loadEntities()
  }, [loadEntities])

  // Filtering
  const getFilteredEntities = useCallback(
    (filter?: EntityFilter): Entity[] => {
      let result = entities

      if (filter?.entity_type) {
        result = result.filter(e => e.entity_type === filter.entity_type)
      }
      if (filter?.is_active !== undefined) {
        result = result.filter(e => e.is_active === filter.is_active)
      }

      return result
    },
    [entities]
  )

  const searchEntitiesAction = useCallback(
    async (query: string, limit?: number): Promise<Entity[]> => {
      if (!currentProfile) {
        return []
      }
      return persistence.searchEntities(currentProfile.id, query, limit)
    },
    [currentProfile]
  )

  // Entity address operations
  const getEntityAddressesAction = useCallback(
    async (entityId: string): Promise<EntityAddress[]> => {
      return persistence.getEntityAddresses(entityId)
    },
    []
  )

  const addEntityAddress = useCallback(
    async (
      address: Omit<EntityAddressInput, 'entity_id'>,
      entityId: string
    ): Promise<EntityAddress> => {
      return persistence.addEntityAddress({
        ...address,
        entity_id: entityId,
      })
    },
    []
  )

  const removeEntityAddress = useCallback(async (id: string): Promise<void> => {
    await persistence.deleteEntityAddress(id)
  }, [])

  // Address detection
  const lookupAddressAction = useCallback(
    async (address: string, chain: string): Promise<AddressMatch | null> => {
      if (!currentProfile) {
        return null
      }
      return persistence.lookupAddress(currentProfile.id, address, chain)
    },
    [currentProfile]
  )

  const batchLookupAddressesAction = useCallback(
    async (addresses: Array<[string, string]>): Promise<AddressMatch[]> => {
      if (!currentProfile) {
        return []
      }
      return persistence.batchLookupAddresses(currentProfile.id, addresses)
    },
    [currentProfile]
  )

  const findEntityByAddressAction = useCallback(
    async (address: string, chain?: string): Promise<Entity | null> => {
      if (!currentProfile) {
        return null
      }
      return persistence.findEntityByAddress(currentProfile.id, address, chain)
    },
    [currentProfile]
  )

  // Known addresses
  const getKnownAddressesAction = useCallback(
    async (chain?: string, entityType?: string): Promise<KnownAddress[]> => {
      const result = await persistence.getKnownAddresses(chain, entityType)
      return result
    },
    []
  )

  const createEntityFromKnownAction = useCallback(
    async (address: string, chain: string): Promise<Entity> => {
      if (!currentProfile) {
        throw new Error('No profile selected')
      }

      const newEntity = await persistence.createEntityFromKnown(
        currentProfile.id,
        address,
        chain
      )
      setEntities(prev =>
        [...prev, newEntity].sort((a, b) => a.name.localeCompare(b.name))
      )
      return newEntity
    },
    [currentProfile]
  )

  return (
    <EntityContext.Provider
      value={{
        entities,
        isLoading,
        error,
        createEntity,
        updateEntity,
        deleteEntity,
        refreshEntities,
        getFilteredEntities,
        searchEntities: searchEntitiesAction,
        getEntityAddresses: getEntityAddressesAction,
        addEntityAddress,
        removeEntityAddress,
        lookupAddress: lookupAddressAction,
        batchLookupAddresses: batchLookupAddressesAction,
        findEntityByAddress: findEntityByAddressAction,
        knownAddresses,
        knownAddressesLoading,
        getKnownAddresses: getKnownAddressesAction,
        createEntityFromKnown: createEntityFromKnownAction,
      }}
    >
      {children}
    </EntityContext.Provider>
  )
}

export const useEntity = () => {
  const context = useContext(EntityContext)
  if (context === undefined) {
    throw new Error('useEntity must be used within an EntityProvider')
  }
  return context
}

// Convenience hooks for specific entity types
export const useVendors = () => {
  const { getFilteredEntities, ...rest } = useEntity()
  const vendors = getFilteredEntities({
    entity_type: 'vendor',
    is_active: true,
  })
  return { vendors, ...rest }
}

export const useCustomers = () => {
  const { getFilteredEntities, ...rest } = useEntity()
  const customers = getFilteredEntities({
    entity_type: 'customer',
    is_active: true,
  })
  return { customers, ...rest }
}
