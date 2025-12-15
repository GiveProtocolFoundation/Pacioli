import React, { useState, useMemo } from 'react'
import {
  Plus,
  Search,
  Building2,
  Users,
  UserCheck,
  MoreVertical,
  Pencil,
  Trash2,
  ExternalLink,
  Filter,
  ChevronDown,
} from 'lucide-react'
import { useEntity } from '../../contexts/EntityContext'
import { useProfile } from '../../contexts/ProfileContext'
import type { Entity, EntityType } from '../../services/persistence'
import EntityForm from './EntityForm'

const entityTypeLabels: Record<EntityType, string> = {
  vendor: 'Vendor',
  customer: 'Customer',
  both: 'Vendor & Customer',
  other: 'Other',
}

const entityTypeIcons: Record<EntityType, React.ReactNode> = {
  vendor: <Building2 className="w-4 h-4" />,
  customer: <Users className="w-4 h-4" />,
  both: <UserCheck className="w-4 h-4" />,
  other: <Building2 className="w-4 h-4" />,
}

const Entities: React.FC = () => {
  const { currentProfile } = useProfile()
  const { entities, isLoading, error, deleteEntity } = useEntity()

  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<EntityType | 'all'>('all')
  const [showInactive, setShowInactive] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Filter and search entities
  const filteredEntities = useMemo(() => {
    return entities.filter((entity) => {
      // Filter by active status
      if (!showInactive && !entity.is_active) return false

      // Filter by type
      if (filterType !== 'all' && entity.entity_type !== filterType) return false

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return (
          entity.name.toLowerCase().includes(query) ||
          entity.display_name?.toLowerCase().includes(query) ||
          entity.email?.toLowerCase().includes(query) ||
          entity.category?.toLowerCase().includes(query)
        )
      }

      return true
    })
  }, [entities, searchQuery, filterType, showInactive])

  const handleEdit = (entity: Entity) => {
    setEditingEntity(entity)
    setIsFormOpen(true)
    setMenuOpenId(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this entity?')) return

    try {
      setDeletingId(id)
      await deleteEntity(id)
    } finally {
      setDeletingId(null)
      setMenuOpenId(null)
    }
  }

  const handleFormClose = () => {
    setIsFormOpen(false)
    setEditingEntity(null)
  }

  const handleFormSuccess = () => {
    handleFormClose()
  }

  if (!currentProfile) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-200">
            Please select a profile to manage entities.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Entities
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage vendors, customers, and other counterparties
          </p>
        </div>
        <button
          onClick={() => setIsFormOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Entity
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search entities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Type filter */}
        <div className="relative">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as EntityType | 'all')}
            className="appearance-none pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Types</option>
            <option value="vendor">Vendors</option>
            <option value="customer">Customers</option>
            <option value="both">Vendor & Customer</option>
            <option value="other">Other</option>
          </select>
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        {/* Show inactive toggle */}
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
          />
          Show inactive
        </label>
      </div>

      {/* Entity list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredEntities.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            No entities found
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {searchQuery || filterType !== 'all'
              ? 'Try adjusting your filters.'
              : 'Get started by adding a new entity.'}
          </p>
          {!searchQuery && filterType === 'all' && (
            <button
              onClick={() => setIsFormOpen(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Entity
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredEntities.map((entity) => (
                <tr
                  key={entity.id}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                    !entity.is_active ? 'opacity-50' : ''
                  }`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                        {entityTypeIcons[entity.entity_type]}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {entity.display_name || entity.name}
                        </div>
                        {entity.display_name && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {entity.name}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                      {entityTypeLabels[entity.entity_type]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {entity.category || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {entity.email || '-'}
                    </div>
                    {entity.website && (
                      <a
                        href={entity.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        Website <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        entity.is_active
                          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                      }`}
                    >
                      {entity.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="relative">
                      <button
                        onClick={() =>
                          setMenuOpenId(menuOpenId === entity.id ? null : entity.id)
                        }
                        className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <MoreVertical className="w-5 h-5 text-gray-400" />
                      </button>
                      {menuOpenId === entity.id && (
                        <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-10">
                          <div className="py-1">
                            <button
                              onClick={() => handleEdit(entity)}
                              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              <Pencil className="w-4 h-4" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(entity.id)}
                              disabled={deletingId === entity.id}
                              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                            >
                              <Trash2 className="w-4 h-4" />
                              {deletingId === entity.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary */}
      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <span>
          Showing {filteredEntities.length} of {entities.length} entities
        </span>
      </div>

      {/* Entity Form Modal */}
      {isFormOpen && (
        <EntityForm
          entity={editingEntity}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  )
}

export default Entities
