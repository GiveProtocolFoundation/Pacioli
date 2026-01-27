import React, { useState, useEffect, useCallback } from 'react'
import { X, Plus, Trash2, Loader } from 'lucide-react'
import { useEntity } from '../../contexts/EntityContext'
import type {
  Entity,
  EntityType,
  EntityAddress,
  TaxDocumentationStatus,
} from '../../services/persistence'

// =============================================================================
// TYPES AND CONSTANTS
// =============================================================================

interface EntityFormProps {
  entity: Entity | null
  onClose: () => void
  onSuccess: () => void
}

interface FormFieldProps {
  id: string
  label: string
  required?: boolean
  children: React.ReactNode
  className?: string
}

interface FormData {
  entity_type: EntityType
  name: string
  display_name: string
  email: string
  phone: string
  website: string
  country_code: string
  tax_identifier: string
  tax_identifier_type: string
  category: string
  default_currency: string
  default_payment_terms: string
  reportable_payee: boolean
  tax_documentation_status: TaxDocumentationStatus
  notes: string
  is_active: boolean
}

interface SectionProps {
  formData: FormData
  onChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => void
}

interface WalletAddressesSectionProps {
  addresses: EntityAddress[]
  loadingAddresses: boolean
  newAddress: { address: string; chain: string; label: string }
  onAddressChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onChainChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  onAddAddress: () => void
  removeAddressHandlers: Record<string, () => void>
}

interface AddressListProps {
  addresses: EntityAddress[]
  removeHandlers: Record<string, () => void>
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

const inputClassName =
  'w-full px-3 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:ring-2 focus:ring-[#c9a961]'

// =============================================================================
// REUSABLE FORM COMPONENTS (defined before use)
// =============================================================================

/** Reusable form field wrapper with label and htmlFor association */
const FormField: React.FC<FormFieldProps> = ({
  id,
  label,
  required,
  children,
  className = '',
}) => (
  <div className={className}>
    <label
      htmlFor={id}
      className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-1"
    >
      {label}
      {required && ' *'}
    </label>
    {children}
  </div>
)

/** Renders a list of wallet addresses with remove buttons */
const AddressList: React.FC<AddressListProps> = ({
  addresses,
  removeHandlers,
}) => (
  <div className="space-y-2">
    {addresses.map(addr => (
      <div
        key={addr.id}
        className="flex items-center gap-2 p-2 bg-[#f3f1ed] dark:bg-[#2a2620] rounded-lg"
      >
        <span className="flex-1 font-mono text-sm truncate">
          {addr.address}
        </span>
        <span className="text-xs text-[#696557] dark:text-[#b8b3ac] bg-[#ede8e0] dark:bg-[#2a2620] px-2 py-0.5 rounded">
          {addr.chain}
        </span>
        {addr.is_verified && (
          <span className="text-xs text-[#7a9b6f] dark:text-[#8faf84]">
            Verified
          </span>
        )}
        <button
          type="button"
          onClick={removeHandlers[addr.id]}
          className="p-1 text-[#9d6b6b] hover:bg-[#9d6b6b]/10 dark:hover:bg-[#9d6b6b]/20 rounded"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    ))}
  </div>
)

/** Section for managing wallet addresses with add/remove functionality */
const WalletAddressesSection: React.FC<WalletAddressesSectionProps> = ({
  addresses,
  loadingAddresses,
  newAddress,
  onAddressChange,
  onChainChange,
  onAddAddress,
  removeAddressHandlers,
}) => (
  <div className="space-y-4">
    <h3 className="text-sm font-medium text-[#1a1815] dark:text-[#f5f3f0]">
      Wallet Addresses
    </h3>
    <div className="flex gap-2">
      <input
        type="text"
        id="wallet_address"
        value={newAddress.address}
        onChange={onAddressChange}
        placeholder="Wallet address"
        className="flex-1 px-3 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:ring-2 focus:ring-[#c9a961] text-sm font-mono"
      />
      <select
        id="wallet_chain"
        value={newAddress.chain}
        onChange={onChainChange}
        className="px-3 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:ring-2 focus:ring-[#c9a961] text-sm"
      >
        <option value="ethereum">Ethereum</option>
        <option value="polkadot">Polkadot</option>
        <option value="moonbeam">Moonbeam</option>
        <option value="moonriver">Moonriver</option>
        <option value="astar">Astar</option>
      </select>
      <button
        type="button"
        onClick={onAddAddress}
        disabled={!newAddress.address}
        className="px-3 py-2 bg-[#8b4e52] text-white rounded-lg hover:bg-[#7a4248] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
    {loadingAddresses ? (
      <div className="flex items-center gap-2 text-sm text-[#696557]">
        <Loader className="w-4 h-4 animate-spin" />
        Loading addresses...
      </div>
    ) : addresses.length === 0 ? (
      <p className="text-sm text-[#696557] dark:text-[#b8b3ac]">
        No wallet addresses added yet.
      </p>
    ) : (
      <AddressList
        addresses={addresses}
        removeHandlers={removeAddressHandlers}
      />
    )}
  </div>
)

/** Section for payment default settings (currency, terms) */
const PaymentSection: React.FC<SectionProps> = ({ formData, onChange }) => (
  <div className="space-y-4">
    <h3 className="text-sm font-medium text-[#1a1815] dark:text-[#f5f3f0]">
      Payment Defaults
    </h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <FormField id="default_currency" label="Default Currency">
        <input
          id="default_currency"
          type="text"
          name="default_currency"
          value={formData.default_currency}
          onChange={onChange}
          placeholder="e.g., USD, EUR"
          maxLength={3}
          className={`${inputClassName} uppercase`}
        />
      </FormField>
      <FormField id="default_payment_terms" label="Payment Terms (days)">
        <input
          id="default_payment_terms"
          type="number"
          name="default_payment_terms"
          value={formData.default_payment_terms}
          onChange={onChange}
          placeholder="e.g., 30"
          min="0"
          className={inputClassName}
        />
      </FormField>
    </div>
  </div>
)

/** Grid of tax-related form fields */
const TaxFieldsGrid: React.FC<SectionProps> = ({ formData, onChange }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <FormField id="country_code" label="Country">
      <input
        id="country_code"
        type="text"
        name="country_code"
        value={formData.country_code}
        onChange={onChange}
        placeholder="e.g., US, GB, DE"
        maxLength={2}
        className={`${inputClassName} uppercase`}
      />
    </FormField>
    <FormField id="tax_identifier_type" label="Tax ID Type">
      <input
        id="tax_identifier_type"
        type="text"
        name="tax_identifier_type"
        value={formData.tax_identifier_type}
        onChange={onChange}
        placeholder="e.g., EIN, VAT, UTR"
        className={inputClassName}
      />
    </FormField>
    <FormField id="tax_identifier" label="Tax Identifier">
      <input
        id="tax_identifier"
        type="text"
        name="tax_identifier"
        value={formData.tax_identifier}
        onChange={onChange}
        className={inputClassName}
      />
    </FormField>
    <FormField id="tax_documentation_status" label="Tax Documentation">
      <select
        id="tax_documentation_status"
        name="tax_documentation_status"
        value={formData.tax_documentation_status}
        onChange={onChange}
        className={inputClassName}
      >
        {taxDocStatuses.map(status => (
          <option key={status.value} value={status.value}>
            {status.label}
          </option>
        ))}
      </select>
    </FormField>
    <div className="sm:col-span-2">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          id="reportable_payee"
          name="reportable_payee"
          checked={formData.reportable_payee}
          onChange={onChange}
          className="rounded border-[rgba(201,169,97,0.15)] text-[#8b4e52] focus:ring-[#c9a961]"
        />
        <span className="text-sm text-[#1a1815] dark:text-[#b8b3ac]">
          Reportable payee (requires tax reporting when paid)
        </span>
      </label>
    </div>
  </div>
)

/** Section for tax and compliance information */
const TaxSection: React.FC<SectionProps> = ({ formData, onChange }) => (
  <div className="space-y-4">
    <h3 className="text-sm font-medium text-[#1a1815] dark:text-[#f5f3f0]">
      Tax & Compliance
    </h3>
    <TaxFieldsGrid formData={formData} onChange={onChange} />
  </div>
)

/** Section for contact information (email, phone, website) */
const ContactSection: React.FC<SectionProps> = ({ formData, onChange }) => (
  <div className="space-y-4">
    <h3 className="text-sm font-medium text-[#1a1815] dark:text-[#f5f3f0]">
      Contact
    </h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <FormField id="email" label="Email">
        <input
          id="email"
          type="email"
          name="email"
          value={formData.email}
          onChange={onChange}
          className={inputClassName}
        />
      </FormField>
      <FormField id="phone" label="Phone">
        <input
          id="phone"
          type="tel"
          name="phone"
          value={formData.phone}
          onChange={onChange}
          className={inputClassName}
        />
      </FormField>
      <FormField id="website" label="Website" className="sm:col-span-2">
        <input
          id="website"
          type="url"
          name="website"
          value={formData.website}
          onChange={onChange}
          placeholder="https://"
          className={inputClassName}
        />
      </FormField>
    </div>
  </div>
)

/** Section for basic entity information (type, name, category) */
const BasicInfoSection: React.FC<SectionProps> = ({ formData, onChange }) => (
  <div className="space-y-4">
    <h3 className="text-sm font-medium text-[#1a1815] dark:text-[#f5f3f0]">
      Basic Information
    </h3>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <FormField id="entity_type" label="Type" required>
        <select
          id="entity_type"
          name="entity_type"
          value={formData.entity_type}
          onChange={onChange}
          required
          className={inputClassName}
        >
          {entityTypes.map(type => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </FormField>
      <FormField id="category" label="Category">
        <input
          id="category"
          type="text"
          name="category"
          value={formData.category}
          onChange={onChange}
          placeholder="e.g., contractor, supplier"
          className={inputClassName}
        />
      </FormField>
      <FormField id="name" label="Name" required>
        <input
          id="name"
          type="text"
          name="name"
          value={formData.name}
          onChange={onChange}
          required
          placeholder="Legal name"
          className={inputClassName}
        />
      </FormField>
      <FormField id="display_name" label="Display Name">
        <input
          id="display_name"
          type="text"
          name="display_name"
          value={formData.display_name}
          onChange={onChange}
          placeholder="Short name for UI"
          className={inputClassName}
        />
      </FormField>
    </div>
  </div>
)

/** Modal header with title and close button */
const FormHeader: React.FC<{ isEditing: boolean; onClose: () => void }> = ({
  isEditing,
  onClose,
}) => (
  <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(201,169,97,0.15)]">
    <h2 className="text-lg font-semibold text-[#1a1815] dark:text-[#f5f3f0]">
      {isEditing ? 'Edit Entity' : 'New Entity'}
    </h2>
    <button
      onClick={onClose}
      className="p-1 rounded-lg hover:bg-[#f3f1ed] dark:hover:bg-[#2a2620]"
    >
      <X className="w-5 h-5 text-[#696557]" />
    </button>
  </div>
)

/** Form footer with cancel and submit buttons */
const FormFooter: React.FC<{
  isSubmitting: boolean
  isEditing: boolean
  onClose: () => void
}> = ({ isSubmitting, isEditing, onClose }) => (
  <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgba(201,169,97,0.15)] bg-[#f3f1ed] dark:bg-[#0f0e0c]">
    <button
      type="button"
      onClick={onClose}
      className="px-4 py-2 text-[#1a1815] dark:text-[#b8b3ac] hover:bg-[#f3f1ed] dark:hover:bg-[#2a2620] rounded-lg transition-colors"
    >
      Cancel
    </button>
    <button
      type="submit"
      disabled={isSubmitting}
      className="px-4 py-2 bg-[#8b4e52] text-white rounded-lg hover:bg-[#7a4248] disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
    >
      {isSubmitting && <Loader className="w-4 h-4 animate-spin" />}
      {isEditing ? 'Save Changes' : 'Create Entity'}
    </button>
  </div>
)

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/** Modal form for creating or editing an entity */
const EntityForm: React.FC<EntityFormProps> = ({
  entity,
  onClose,
  onSuccess,
}) => {
  const {
    createEntity,
    updateEntity,
    getEntityAddresses,
    addEntityAddress,
    removeEntityAddress,
  } = useEntity()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addresses, setAddresses] = useState<EntityAddress[]>([])
  const [loadingAddresses, setLoadingAddresses] = useState(false)

  const [formData, setFormData] = useState<FormData>({
    entity_type: 'vendor',
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
    tax_documentation_status: 'none',
    notes: '',
    is_active: true,
  })

  const [newAddress, setNewAddress] = useState({
    address: '',
    chain: 'ethereum',
    label: '',
  })

  const handleNewAddressChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setNewAddress(prev => ({ ...prev, address: e.target.value }))
    },
    []
  )

  const handleNewAddressChainChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setNewAddress(prev => ({ ...prev, chain: e.target.value }))
    },
    []
  )

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
      loadAddresses(entity.id)
    }
  }, [entity, loadAddresses])

  const handleInputChange = useCallback(
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >
    ) => {
      const { name, value, type } = e.target
      setFormData(prev => ({
        ...prev,
        [name]:
          type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
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
      setAddresses(prev => [added, ...prev])
      setNewAddress({ address: '', chain: 'ethereum', label: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add address')
    }
  }, [entity, newAddress, addEntityAddress])

  const handleRemoveAddress = useCallback(
    async (id: string) => {
      try {
        await removeEntityAddress(id)
        setAddresses(prev => prev.filter(a => a.id !== id))
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to remove address'
        )
      }
    },
    [removeEntityAddress]
  )

  const removeAddressHandlers = React.useMemo(() => {
    const handlers: Record<string, () => void> = {}
    addresses.forEach(addr => {
      handlers[addr.id] = () => handleRemoveAddress(addr.id)
    })
    return handlers
  }, [addresses, handleRemoveAddress])

  const BodySection = () => (
    <div className="p-6 space-y-6">
      {error && (
        <div className="bg-[#9d6b6b]/10 dark:bg-[#9d6b6b]/20 border border-[#9d6b6b]/30 dark:border-[#9d6b6b]/40 rounded-lg p-4">
          <p className="text-[#9d6b6b] dark:text-[#b88585] text-sm">{error}</p>
        </div>
      )}
      <BasicInfoSection formData={formData} onChange={handleInputChange} />
      <ContactSection formData={formData} onChange={handleInputChange} />
      <TaxSection formData={formData} onChange={handleInputChange} />
      <PaymentSection formData={formData} onChange={handleInputChange} />
      {entity && (
        <WalletAddressesSection
          addresses={addresses}
          loadingAddresses={loadingAddresses}
          newAddress={newAddress}
          onAddressChange={handleNewAddressChange}
          onChainChange={handleNewAddressChainChange}
          onAddAddress={handleAddAddress}
          removeAddressHandlers={removeAddressHandlers}
        />
      )}
      <FormField id="notes" label="Notes">
        <textarea
          id="notes"
          name="notes"
          value={formData.notes}
          onChange={handleInputChange}
          rows={3}
          className={inputClassName}
        />
      </FormField>
      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_active"
            name="is_active"
            checked={formData.is_active}
            onChange={handleInputChange}
            className="rounded border-[rgba(201,169,97,0.15)] text-[#8b4e52] focus:ring-[#c9a961]"
          />
          <span className="text-sm text-[#1a1815] dark:text-[#b8b3ac]">
            Active
          </span>
        </label>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#fafaf8] dark:bg-[#1a1815] rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <FormHeader isEditing={Boolean(entity)} onClose={onClose} />
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <BodySection />
          <FormFooter
            isSubmitting={isSubmitting}
            isEditing={Boolean(entity)}
            onClose={onClose}
          />
        </form>
      </div>
    </div>
  )
}

export default EntityForm
