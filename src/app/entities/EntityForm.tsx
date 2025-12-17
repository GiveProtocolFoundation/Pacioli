import React, { useState, useEffect, useCallback } from 'react'
import { X, Plus, Trash2, Loader } from 'lucide-react'
import { useEntity } from '../../contexts/EntityContext'
import type {
  Entity,
  EntityType,
  EntityAddress,
  TaxDocumentationStatus,
} from '../../services/persistence'

interface EntityFormProps {
  entity: Entity | null
  onClose: () => void
  onSuccess: () => void
}

const entityTypes: { value: EntityType; label: string }[] = [
  { value: 'vendor', label: 'Vendor' },
  { value: 'customer', label: 'Customer' },
  { value: 'both', label: 'Vendor & Customer' },
  { value: 'other', label: 'Other' },
]

const taxDocStatuses: { value: TaxDocumentationStatus; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'requested', label: 'Requested' },
  { value: 'received', label: 'Received' },
  { value: 'verified', label: 'Verified' },
  { value: 'expired', label: 'Expired' },
]

const EntityForm: React.FC<EntityFormProps> = ({ entity, onClose, onSuccess }) => {
  const { createEntity, updateEntity, getEntityAddresses, addEntityAddress, removeEntityAddress } =
    useEntity()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addresses, setAddresses] = useState<EntityAddress[]>([])
  const [loadingAddresses, setLoadingAddresses] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    entity_type: 'vendor' as EntityType,
    name: '',
    display_name: '',
    email: '',
    phone: '',
    website: '',
    country_code: '',
    tax_identifier: '',
    tax_identifier_type: '',
    category: '',
    default_currency: '',
    default_payment_terms: '',
    reportable_payee: false,
    tax_documentation_status: 'none' as TaxDocumentationStatus,
    notes: '',
    is_active: true,
  })

  // New address form
  const [newAddress, setNewAddress] = useState({
    address: '',
    chain: 'ethereum',
    label: '',
  })

  // Handlers for new address form (using useCallback to avoid recreating on each render)
  const handleNewAddressChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setNewAddress((prev) => ({ ...prev, address: e.target.value }))
    },
    []
  )

  const handleNewAddressChainChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setNewAddress((prev) => ({ ...prev, chain: e.target.value }))
    },
    []
  )

  // Load addresses for an entity
  const loadAddresses = useCallback(
    async (entityId: string) => {
      try {
        setLoadingAddresses(true)
        const loaded = await getEntityAddresses(entityId)
        setAddresses(loaded)
      } finally {
        setLoadingAddresses(false)
      }
    },
    [getEntityAddresses]
  )

  // Load entity data if editing
  useEffect(() => {
    if (entity) {
      setFormData({
        entity_type: entity.entity_type,
        name: entity.name,
        display_name: entity.display_name || '',
        email: entity.email || '',
        phone: entity.phone || '',
        website: entity.website || '',
        country_code: entity.country_code || '',
        tax_identifier: entity.tax_identifier || '',
        tax_identifier_type: entity.tax_identifier_type || '',
        category: entity.category || '',
        default_currency: entity.default_currency || '',
        default_payment_terms: entity.default_payment_terms?.toString() || '',
        reportable_payee: entity.reportable_payee,
        tax_documentation_status: entity.tax_documentation_status,
        notes: entity.notes || '',
        is_active: entity.is_active,
      })

      // Load addresses
      loadAddresses(entity.id)
    }
  }, [entity, loadAddresses])

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const { name, value, type } = e.target
      setFormData((prev) => ({
        ...prev,
        [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
      }))
    },
    []
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)
      setIsSubmitting(true)

      try {
        const data = {
          entity_type: formData.entity_type,
          name: formData.name,
          display_name: formData.display_name || undefined,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          website: formData.website || undefined,
          country_code: formData.country_code || undefined,
          tax_identifier: formData.tax_identifier || undefined,
          tax_identifier_type: formData.tax_identifier_type || undefined,
          category: formData.category || undefined,
          default_currency: formData.default_currency || undefined,
          default_payment_terms: formData.default_payment_terms
            ? parseInt(formData.default_payment_terms)
            : undefined,
          reportable_payee: formData.reportable_payee,
          tax_documentation_status: formData.tax_documentation_status,
          notes: formData.notes || undefined,
          is_active: formData.is_active,
        }

        if (entity) {
          await updateEntity(entity.id, data)
        } else {
          await createEntity(data)
        }

        onSuccess()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save entity')
      } finally {
        setIsSubmitting(false)
      }
    },
    [formData, entity, updateEntity, createEntity, onSuccess]
  )

  const handleAddAddress = useCallback(async () => {
    if (!entity || !newAddress.address) return

    try {
      const added = await addEntityAddress(
        {
          address: newAddress.address,
          chain: newAddress.chain,
          label: newAddress.label || undefined,
        },
        entity.id
      )
      setAddresses((prev) => [added, ...prev])
      setNewAddress({ address: '', chain: 'ethereum', label: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add address')
    }
  }, [entity, newAddress, addEntityAddress])

  const handleRemoveAddress = useCallback(
    async (id: string) => {
      try {
        await removeEntityAddress(id)
        setAddresses((prev) => prev.filter((a) => a.id !== id))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove address')
      }
    },
    [removeEntityAddress]
  )

  // Create memoized remove handlers to avoid recreating functions on each render
  const removeAddressHandlers = React.useMemo(() => {
    const handlers: Record<string, () => void> = {}
    addresses.forEach((addr) => {
      handlers[addr.id] = () => handleRemoveAddress(addr.id)
    })
    return handlers
  }, [addresses, handleRemoveAddress])

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {entity ? 'Edit Entity' : 'New Entity'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
              </div>
            )}

            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                Basic Information
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Type *
                  </label>
                  <select
                    name="entity_type"
                    value={formData.entity_type}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    {entityTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    placeholder="e.g., contractor, supplier"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    placeholder="Legal name"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    name="display_name"
                    value={formData.display_name}
                    onChange={handleInputChange}
                    placeholder="Short name for UI"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">Contact</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Website
                  </label>
                  <input
                    type="url"
                    name="website"
                    value={formData.website}
                    onChange={handleInputChange}
                    placeholder="https://"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Tax Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                Tax & Compliance
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    name="country_code"
                    value={formData.country_code}
                    onChange={handleInputChange}
                    placeholder="e.g., US, GB, DE"
                    maxLength={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tax ID Type
                  </label>
                  <input
                    type="text"
                    name="tax_identifier_type"
                    value={formData.tax_identifier_type}
                    onChange={handleInputChange}
                    placeholder="e.g., EIN, VAT, UTR"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tax Identifier
                  </label>
                  <input
                    type="text"
                    name="tax_identifier"
                    value={formData.tax_identifier}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tax Documentation
                  </label>
                  <select
                    name="tax_documentation_status"
                    value={formData.tax_documentation_status}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    {taxDocStatuses.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="reportable_payee"
                      checked={formData.reportable_payee}
                      onChange={handleInputChange}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Reportable payee (requires tax reporting when paid)
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Payment Defaults */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                Payment Defaults
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Default Currency
                  </label>
                  <input
                    type="text"
                    name="default_currency"
                    value={formData.default_currency}
                    onChange={handleInputChange}
                    placeholder="e.g., USD, EUR"
                    maxLength={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Payment Terms (days)
                  </label>
                  <input
                    type="number"
                    name="default_payment_terms"
                    value={formData.default_payment_terms}
                    onChange={handleInputChange}
                    placeholder="e.g., 30"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Wallet Addresses (only when editing) */}
            {entity && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  Wallet Addresses
                </h3>

                {/* Add address form */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newAddress.address}
                    onChange={handleNewAddressChange}
                    placeholder="Wallet address"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                  />
                  <select
                    value={newAddress.chain}
                    onChange={handleNewAddressChainChange}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="ethereum">Ethereum</option>
                    <option value="polkadot">Polkadot</option>
                    <option value="moonbeam">Moonbeam</option>
                    <option value="moonriver">Moonriver</option>
                    <option value="astar">Astar</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddAddress}
                    disabled={!newAddress.address}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Address list */}
                {loadingAddresses ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader className="w-4 h-4 animate-spin" />
                    Loading addresses...
                  </div>
                ) : addresses.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No wallet addresses added yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {addresses.map((addr) => (
                      <div
                        key={addr.id}
                        className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                      >
                        <span className="flex-1 font-mono text-sm truncate">
                          {addr.address}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded">
                          {addr.chain}
                        </span>
                        {addr.is_verified && (
                          <span className="text-xs text-green-600 dark:text-green-400">
                            Verified
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={removeAddressHandlers[addr.id]}
                          className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Status */}
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleInputChange}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
            >
              {isSubmitting && <Loader className="w-4 h-4 animate-spin" />}
              {entity ? 'Save Changes' : 'Create Entity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EntityForm
