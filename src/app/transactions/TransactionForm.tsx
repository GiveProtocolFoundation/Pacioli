import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Save,
  X,
  Calendar,
  DollarSign,
  FileText,
  Tag,
  Wallet as WalletIcon,
  Users,
  Search,
  Plus,
  ArrowRightLeft,
} from 'lucide-react'
import { DatePicker } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { useTransactions } from '../../contexts/TransactionContext'
import { useCurrency } from '../../contexts/CurrencyContext'
import { useTokens } from '../../contexts/TokenContext'
import { useWalletAliases } from '../../contexts/WalletAliasContext'
import { useEntity } from '../../contexts/EntityContext'
import { TransactionFormData } from '../../types/transaction'
import {
  Token,
  Chain,
  getDigitalAssetTypeInfo,
} from '../../types/digitalAssets'
import TokenSelector from '../../components/common/TokenSelector'
import {
  TransactionCategory,
  TransactionTypeDefinition,
  getAllCategories,
  getAllSubcategories,
  getTransactionTypesBySubcategory,
  getTransactionTypeByCode,
} from '../../types/transaction-categories'
import {
  StorageService,
  TrackedWallet,
} from '../../services/database/storageService'
import { ConnectedWallet } from '../../services/wallet/types'
import { Entity } from '../../services/persistence/types'

/** Transaction type code for transfers between own wallets */
const TRANSFER_OWN_WALLETS_CODE = 'DSP_TRANSFER_OWN'

/** Wallet option derived from connected or tracked wallets */
interface WalletOption {
  address: string
  name: string
  displayName: string
  walletType: string
  source: 'extension' | 'tracked'
}

/** Props for the CounterpartySelector sub-component */
interface CounterpartySelectorProps {
  isTransferBetweenOwnWallets: boolean
  formData: TransactionFormData
  selectedEntity: Entity | undefined
  entitySearchQuery: string
  showEntityDropdown: boolean
  filteredEntities: Entity[]
  entityClickHandlers: Record<string, () => void>
  destinationWalletOptions: WalletOption[]
  handleDestinationWalletChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  handleClearEntity: () => void
  handleEntitySearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleEntityInputFocus: () => void
  handleEntityInputBlur: () => void
}

/**
 * Renders either the destination wallet selector (for transfers between own wallets)
 * or the entity/counterparty selector (for external transactions).
 * Extracted from TransactionForm to reduce JSX nesting depth.
 */
const CounterpartySelector: React.FC<CounterpartySelectorProps> = ({
  isTransferBetweenOwnWallets,
  formData,
  selectedEntity,
  entitySearchQuery,
  showEntityDropdown,
  filteredEntities,
  entityClickHandlers,
  destinationWalletOptions,
  handleDestinationWalletChange,
  handleClearEntity,
  handleEntitySearchChange,
  handleEntityInputFocus,
  handleEntityInputBlur,
}) => {
  if (isTransferBetweenOwnWallets) {
    return (
      <div className="p-4 bg-[#5FE3C0]/10 dark:bg-[#5FE3C0]/20 rounded-lg border border-[#5FE3C0]/30">
        <label
          htmlFor="txn-destination-wallet"
          className="block text-sm font-medium text-[#11202B] dark:text-[#9FB4BE] mb-2"
        >
          <div className="flex items-center">
            <ArrowRightLeft className="w-4 h-4 mr-2 text-[#294050]" />
            Destination Wallet
          </div>
        </label>
        <p className="text-xs text-[#294050] dark:text-[#647D8B] mb-2">
          Select the receiving wallet for this internal transfer
        </p>
        <select
          id="txn-destination-wallet"
          value={formData.destinationWallet}
          onChange={handleDestinationWalletChange}
          className="w-full px-4 py-2 border border-[rgba(95,227,192,0.15)] rounded-lg bg-[#F7FAFA] dark:bg-[#11202B] text-[#11202B] dark:text-[#EAF3F2] focus:outline-none focus:ring-2 focus:ring-[#5FE3C0]"
        >
          <option value="">Select destination wallet...</option>
          {destinationWalletOptions.map(wallet => (
            <option key={wallet.address} value={wallet.address}>
              {wallet.displayName} - {wallet.walletType}
            </option>
          ))}
        </select>
        {destinationWalletOptions.length === 0 && formData.wallet && (
          <p className="mt-2 text-xs text-[#E8836F]">
            No other wallets available. Add more wallets in the Wallet
            Manager.
          </p>
        )}
        {!formData.wallet && (
          <p className="mt-2 text-xs text-[#E8836F]">
            Please select a source wallet first.
          </p>
        )}
      </div>
    )
  }

  return (
    /* Entity/Counterparty Selector (for external transactions) */
    <div>
      <label
        htmlFor="txn-entity"
        className="block text-sm font-medium text-[#11202B] dark:text-[#9FB4BE] mb-2"
      >
        <div className="flex items-center">
          <Users className="w-4 h-4 mr-2" />
          Counterparty (Optional)
        </div>
      </label>
      <p className="text-xs text-gray-500 dark:text-[#647D8B] mb-2">
        Link this transaction to a vendor, customer, or other entity
      </p>

      {selectedEntity ? (
        <div className="flex items-center gap-2 p-3 bg-[#5FE3C0]/10 dark:bg-[#5FE3C0]/20 border border-[#5FE3C0]/30 dark:border-[#5FE3C0]/40 rounded-lg">
          <div className="flex-1">
            <div className="font-medium text-[#11202B] dark:text-[#EAF3F2]">
              {selectedEntity.display_name || selectedEntity.name}
            </div>
            <div className="text-xs text-gray-500 dark:text-[#647D8B]">
              {selectedEntity.entity_type.charAt(0).toUpperCase() +
                selectedEntity.entity_type.slice(1)}
              {selectedEntity.category &&
                ` · ${selectedEntity.category}`}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClearEntity}
            className="p-1 text-[#647D8B] hover:text-[#294050] dark:hover:text-[#9FB4BE]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#647D8B]" />
            <input
              id="txn-entity"
              type="text"
              value={entitySearchQuery}
              onChange={handleEntitySearchChange}
              onFocus={handleEntityInputFocus}
              onBlur={handleEntityInputBlur}
              placeholder="Search entities by name..."
              className="w-full pl-16 pr-4 py-2 border border-[rgba(95,227,192,0.15)] rounded-lg bg-[#F7FAFA] dark:bg-[#11202B] text-[#11202B] dark:text-[#EAF3F2] placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#5FE3C0]"
            />
          </div>

          {showEntityDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-[#F7FAFA] dark:bg-[#11202B] border border-[rgba(95,227,192,0.15)] rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredEntities.length > 0 ? (
                filteredEntities.map(entity => (
                  <button
                    key={entity.id}
                    type="button"
                    onClick={entityClickHandlers[entity.id]}
                    className="w-full px-4 py-2 text-left hover:bg-[#EAF3F2] dark:hover:bg-[#16242F] flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium text-[#11202B] dark:text-[#EAF3F2]">
                        {entity.display_name || entity.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-[#647D8B]">
                        {entity.entity_type.charAt(0).toUpperCase() +
                          entity.entity_type.slice(1)}
                        {entity.category && ` · ${entity.category}`}
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-center text-gray-500 dark:text-[#647D8B]">
                  <p className="text-sm">No entities found</p>
                  <a
                    href="/entities"
                    className="text-xs text-[#294050] dark:text-[#F09988] hover:underline inline-flex items-center gap-1 mt-1"
                  >
                    <Plus className="w-3 h-3" />
                    Create new entity
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Props for the TransactionClassificationSection sub-component */
interface TransactionClassificationSectionProps {
  formData: TransactionFormData
  availableCategories: TransactionCategory[]
  availableSubcategories: string[]
  availableTransactionTypes: TransactionTypeDefinition[]
  selectedTransactionType: TransactionTypeDefinition | undefined
  handleCategoryChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  handleTransactionSubcategoryChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  handleTransactionTypeCodeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
}

/**
 * Renders the "Transaction Classification" section with category, subcategory,
 * and transaction type dropdowns, plus suggested accounts display.
 * Extracted from TransactionForm to reduce JSX nesting depth.
 */
const TransactionClassificationSection: React.FC<TransactionClassificationSectionProps> = ({
  formData,
  availableCategories,
  availableSubcategories,
  availableTransactionTypes,
  selectedTransactionType,
  handleCategoryChange,
  handleTransactionSubcategoryChange,
  handleTransactionTypeCodeChange,
}) => (
  <div className="space-y-4 p-4 bg-[#5FE3C0]/10 dark:bg-[#5FE3C0]/20 rounded-lg border border-[#5FE3C0]/30 dark:border-[#5FE3C0]/40">
    <h3 className="text-sm font-semibold text-[#294050] dark:text-[#9CF1DC] flex items-center">
      <Tag className="w-4 h-4 mr-2" />
      Transaction Classification
    </h3>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <label
          htmlFor="txn-category"
          className="block text-sm font-medium text-[#11202B] dark:text-[#9FB4BE] mb-2"
        >
          Category
        </label>
        <select
          id="txn-category"
          value={formData.transactionCategory || ''}
          onChange={handleCategoryChange}
          className="w-full px-4 py-2 border border-[rgba(95,227,192,0.15)] rounded-lg bg-[#F7FAFA] dark:bg-[#11202B] text-[#11202B] dark:text-[#EAF3F2] focus:outline-none focus:ring-2 focus:ring-[#5FE3C0]"
        >
          <option value="">Select category</option>
          {availableCategories.map(cat => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="txn-subcategory"
          className="block text-sm font-medium text-[#11202B] dark:text-[#9FB4BE] mb-2"
        >
          Subcategory
        </label>
        <select
          id="txn-subcategory"
          value={formData.transactionSubcategory || ''}
          onChange={handleTransactionSubcategoryChange}
          disabled={!formData.transactionCategory}
          className="w-full px-4 py-2 border border-[rgba(95,227,192,0.15)] rounded-lg bg-[#F7FAFA] dark:bg-[#11202B] text-[#11202B] dark:text-[#EAF3F2] focus:outline-none focus:ring-2 focus:ring-[#5FE3C0] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">Select subcategory</option>
          {availableSubcategories.map(subcat => (
            <option key={subcat} value={subcat}>
              {subcat}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="txn-type"
          className="block text-sm font-medium text-[#11202B] dark:text-[#9FB4BE] mb-2"
        >
          Transaction Type
        </label>
        <select
          id="txn-type"
          value={formData.transactionTypeCode || ''}
          onChange={handleTransactionTypeCodeChange}
          disabled={!formData.transactionSubcategory}
          className="w-full px-4 py-2 border border-[rgba(95,227,192,0.15)] rounded-lg bg-[#F7FAFA] dark:bg-[#11202B] text-[#11202B] dark:text-[#EAF3F2] focus:outline-none focus:ring-2 focus:ring-[#5FE3C0] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">Select transaction type</option>
          {availableTransactionTypes.map(txnType => (
            <option key={txnType.code} value={txnType.code}>
              {txnType.transactionType}
            </option>
          ))}
        </select>
      </div>
    </div>

    {selectedTransactionType && (
      <div className="mt-4 p-3 bg-[#F7FAFA] dark:bg-[#11202B] rounded-lg border border-[rgba(95,227,192,0.15)]">
        <h4 className="text-xs font-semibold text-[#11202B] dark:text-[#9FB4BE] mb-2">
          Suggested Accounts
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div>
            <span className="font-medium text-[#5FE3C0] dark:text-[#9CF1DC]">
              Debit:
            </span>
            <p className="text-[#11202B] dark:text-[#EAF3F2] mt-1">
              {selectedTransactionType.debitAccounts}
            </p>
          </div>
          <div>
            <span className="font-medium text-[#E8836F] dark:text-[#F09988]">
              Credit:
            </span>
            <p className="text-[#11202B] dark:text-[#EAF3F2] mt-1">
              {selectedTransactionType.creditAccounts}
            </p>
          </div>
        </div>
      </div>
    )}
  </div>
)

/** Props for the AmountSection sub-component */
interface AmountSectionProps {
  formData: TransactionFormData
  errors: Partial<Record<keyof TransactionFormData, string>>
  selectedToken: Token | undefined
  currencySettings: { primaryCurrency: string }
  handleAmountInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleFiatValueChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

/**
 * Renders the amount and fiat value input grid.
 * Extracted from TransactionForm to reduce JSX nesting depth.
 */
const AmountSection: React.FC<AmountSectionProps> = ({
  formData,
  errors,
  selectedToken,
  currencySettings,
  handleAmountInputChange,
  handleFiatValueChange,
}) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div>
      <label
        htmlFor="txn-amount"
        className="block text-sm font-medium text-[#11202B] dark:text-[#9FB4BE] mb-2"
      >
        <div className="flex items-center">
          <DollarSign className="w-4 h-4 mr-2" />
          Amount
        </div>
      </label>
      <input
        id="txn-amount"
        type="number"
        step="0.000001"
        value={formData.amount}
        onChange={handleAmountInputChange}
        placeholder="0.00"
        className={`w-full px-4 py-2 border rounded-lg bg-[#F7FAFA] dark:bg-[#11202B] text-[#11202B] dark:text-[#EAF3F2] ${
          errors.amount
            ? 'border-[#E8836F]'
            : 'border-[rgba(95,227,192,0.15)]'
        } focus:outline-none focus:ring-2 focus:ring-[#5FE3C0]`}
      />
      {errors.amount && (
        <p className="mt-1 text-sm text-[#E8836F]">{errors.amount}</p>
      )}
      {selectedToken && (
        <p className="mt-1 text-xs text-[#294050] dark:text-[#9FB4BE]">
          {selectedToken.symbol} ({selectedToken.decimals} decimals)
        </p>
      )}
    </div>

    <div>
      <label
        htmlFor="txn-fiat-value"
        className="block text-sm font-medium text-[#11202B] dark:text-[#9FB4BE] mb-2"
      >
        {currencySettings.primaryCurrency} Value
      </label>
      <input
        id="txn-fiat-value"
        type="number"
        step="0.01"
        value={formData.fiatValue}
        onChange={handleFiatValueChange}
        placeholder="0.00"
        className="w-full px-4 py-2 border border-[rgba(95,227,192,0.15)] rounded-lg bg-[#F7FAFA] dark:bg-[#11202B] text-[#11202B] dark:text-[#EAF3F2] focus:outline-none focus:ring-2 focus:ring-[#5FE3C0]"
      />
    </div>
  </div>
)

/** Form for creating and editing crypto transactions with classification, entity linking, and wallet selection */
const TransactionForm: React.FC = () => { // skipcq: JS-R1005 — form with many fields; sub-components already extracted
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const { addTransaction, updateTransaction, getTransaction } =
    useTransactions()
  const { settings: currencySettings } = useCurrency()
  const { getToken, getChain } = useTokens()
  const { entities } = useEntity()

  const isEditMode = Boolean(id)
  const existingTransaction = id ? getTransaction(id) : undefined

  // Helper to parse date string to dayjs object
  const parseDateToDayjs = (dateStr: string | undefined): Dayjs => {
    if (!dateStr) return dayjs()

    const parsed = dayjs(dateStr)
    return parsed.isValid() ? parsed : dayjs()
  }

  // Helper to format dayjs to ISO string for storage
  const formatDayjsForStorage = (date: Dayjs | null): string => {
    if (!date) return dayjs().toISOString()
    return date.toISOString()
  }

  const [formData, setFormData] = useState<TransactionFormData>({
    date: existingTransaction?.date || dayjs().toISOString(),
    description: existingTransaction?.description || '',
    type: existingTransaction?.type || 'revenue',
    category: existingTransaction?.category || '',
    wallet: existingTransaction?.wallet || '',
    tokenId: existingTransaction?.tokenId || '',
    chainId: existingTransaction?.chainId || '',
    amount: existingTransaction?.amount || 0,
    fiatValue: existingTransaction?.fiatValue || 0,
    fiatCurrency:
      existingTransaction?.fiatCurrency || currencySettings.primaryCurrency,
    hash: existingTransaction?.hash || '',
    accountCode: existingTransaction?.accountCode || '',
    accountName: existingTransaction?.accountName || '',
    digitalAssetType: existingTransaction?.digitalAssetType || '',
    memo: existingTransaction?.memo || '',
    crypto: existingTransaction?.crypto,
    entityId: existingTransaction?.entityId || '',
    entityName: existingTransaction?.entityName || '',
    destinationWallet: existingTransaction?.destinationWallet || '',
  })

  const [errors, setErrors] = useState<
    Partial<Record<keyof TransactionFormData, string>>
  >({})
  const [isSaving, setIsSaving] = useState(false)

  // Connected wallets and aliases
  const { formatWalletDisplay } = useWalletAliases()
  const [connectedWallets, setConnectedWallets] = useState<ConnectedWallet[]>(
    []
  )
  const [trackedWallets, setTrackedWallets] = useState<TrackedWallet[]>([])

  useEffect(() => {
    if (!isEditMode) {
      setFormData(prev => ({
        ...prev,
        fiatCurrency: currencySettings.primaryCurrency,
      }))
    }
  }, [currencySettings.primaryCurrency, isEditMode])

  // Load connected and tracked wallets on mount
  useEffect(() => {
    const savedWallets = StorageService.loadWallets()
    setConnectedWallets(savedWallets)
    const savedTrackedWallets = StorageService.loadTrackedWallets()
    setTrackedWallets(savedTrackedWallets)
  }, [])

  // Build wallet options from BOTH connected wallets AND tracked wallets
  const walletOptions = useMemo(() => {
    const options: WalletOption[] = []

    // Add wallets from browser extensions
    connectedWallets.forEach(wallet => {
      wallet.accounts.forEach(acc => {
        options.push({
          address: acc.address,
          name: acc.name || 'Unnamed',
          displayName: formatWalletDisplay(acc.address, acc.name),
          walletType: wallet.type,
          source: 'extension',
        })
      })
    })

    // Add tracked wallets (manually added or via WalletConnect)
    trackedWallets.forEach(wallet => {
      // Avoid duplicates if same address exists in connected wallets
      if (!options.some(opt => opt.address === wallet.address)) {
        options.push({
          address: wallet.address,
          name: wallet.label || 'Tracked Wallet',
          displayName: formatWalletDisplay(wallet.address, wallet.label),
          walletType: wallet.blockchain,
          source: 'tracked',
        })
      }
    })

    return options
  }, [connectedWallets, trackedWallets, formatWalletDisplay])

  // Check if "Transfer Between Own Wallets" is selected
  const isTransferBetweenOwnWallets =
    formData.transactionTypeCode === TRANSFER_OWN_WALLETS_CODE

  // Destination wallet options (exclude source wallet)
  const destinationWalletOptions = useMemo(() => {
    return walletOptions.filter(opt => opt.address !== formData.wallet)
  }, [walletOptions, formData.wallet])

  // Entity selector state
  const [entitySearchQuery, setEntitySearchQuery] = useState('')
  const [showEntityDropdown, setShowEntityDropdown] = useState(false)

  // Filter entities based on search query
  const filteredEntities = useMemo(() => {
    if (!entitySearchQuery.trim()) {
      return entities.filter(e => e.is_active).slice(0, 10)
    }
    const query = entitySearchQuery.toLowerCase()
    return entities
      .filter(
        e =>
          e.is_active &&
          (e.name.toLowerCase().includes(query) ||
            e.display_name?.toLowerCase().includes(query) ||
            e.category?.toLowerCase().includes(query))
      )
      .slice(0, 10)
  }, [entities, entitySearchQuery])

  // Get selected entity
  const selectedEntity = useMemo(
    () => entities.find(e => e.id === formData.entityId),
    [entities, formData.entityId]
  )

  const selectedToken = formData.tokenId
    ? getToken(formData.tokenId)
    : undefined
  const selectedChain = formData.chainId
    ? getChain(formData.chainId)
    : undefined

  // Get available options based on selections
  const availableCategories = getAllCategories()
  const availableSubcategories = formData.transactionCategory
    ? getAllSubcategories(formData.transactionCategory as TransactionCategory)
    : []
  const availableTransactionTypes = formData.transactionSubcategory
    ? getTransactionTypesBySubcategory(formData.transactionSubcategory)
    : []
  const selectedTransactionType = formData.transactionTypeCode
    ? getTransactionTypeByCode(formData.transactionTypeCode)
    : undefined

  const handleInputChange = useCallback(
    (field: keyof TransactionFormData, value: string | number) => {
      setFormData(prev => ({ ...prev, [field]: value }))
      if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: undefined }))
      }
    },
    [errors]
  )

  const handleTokenSelect = useCallback(
    (token: Token, chain: Chain) => {
      setFormData(prev => ({
        ...prev,
        tokenId: token.id,
        chainId: chain.chainId,
        digitalAssetType: token.digitalAssetType,
        accountCode: getDigitalAssetTypeInfo(token.digitalAssetType)
          .accountNumber,
        accountName: getDigitalAssetTypeInfo(token.digitalAssetType).name,
      }))
      if (errors.tokenId) {
        setErrors(prev => ({ ...prev, tokenId: undefined }))
      }
    },
    [errors.tokenId]
  )

  const handleAmountChange = useCallback(
    (value: string) => {
      const amount = parseFloat(value) || 0
      handleInputChange('amount', amount)

      const estimatedFiatValue = amount * 7.5
      handleInputChange('fiatValue', estimatedFiatValue)
    },
    [handleInputChange]
  )

  // Field-specific handlers to avoid inline arrow functions
  const handleAccountNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleInputChange('accountName', e.target.value)
    },
    [handleInputChange]
  )

  const handleAccountCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleInputChange('accountCode', e.target.value)
    },
    [handleInputChange]
  )

  const handleFiatValueChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleInputChange('fiatValue', parseFloat(e.target.value) || 0)
    },
    [handleInputChange]
  )

  const handleTransactionTypeCodeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newCode = e.target.value
      handleInputChange('transactionTypeCode', newCode)

      // Clear destination wallet when switching away from transfer between own wallets
      if (newCode !== TRANSFER_OWN_WALLETS_CODE) {
        handleInputChange('destinationWallet', '')
      }
      // Clear entity when switching to transfer between own wallets
      if (newCode === TRANSFER_OWN_WALLETS_CODE) {
        handleInputChange('entityId', '')
        handleInputChange('entityName', '')
      }
    },
    [handleInputChange]
  )

  const handleTransactionSubcategoryChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      handleInputChange('transactionSubcategory', e.target.value)
      handleInputChange('transactionTypeCode', '')
    },
    [handleInputChange]
  )

  const handleDateChange = useCallback(
    (date: Dayjs | null) => {
      handleInputChange('date', formatDayjsForStorage(date))
    },
    [handleInputChange]
  )

  const handleWalletChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      handleInputChange('wallet', e.target.value)
    },
    [handleInputChange]
  )

  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleInputChange('description', e.target.value)
    },
    [handleInputChange]
  )

  const handleCategoryChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      handleInputChange('transactionCategory', e.target.value)
      handleInputChange('transactionSubcategory', '')
      handleInputChange('transactionTypeCode', '')
    },
    [handleInputChange]
  )

  const handleAmountInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleAmountChange(e.target.value)
    },
    [handleAmountChange]
  )

  const handleHashChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleInputChange('hash', e.target.value)
    },
    [handleInputChange]
  )

  const handleMemoChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      handleInputChange('memo', e.target.value)
    },
    [handleInputChange]
  )

  const handleDestinationWalletChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      handleInputChange('destinationWallet', e.target.value)
    },
    [handleInputChange]
  )

  // Entity handlers
  const handleEntitySearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEntitySearchQuery(e.target.value)
      setShowEntityDropdown(true)
    },
    []
  )

  const handleEntitySelect = useCallback(
    (entityId: string, entityName: string) => {
      handleInputChange('entityId', entityId)
      handleInputChange('entityName', entityName)
      setEntitySearchQuery('')
      setShowEntityDropdown(false)
    },
    [handleInputChange]
  )

  // Pre-create click handlers for entity dropdown to avoid inline arrow functions
  const entityClickHandlers = useMemo(() => {
    const handlers: Record<string, () => void> = {}
    filteredEntities.forEach(entity => {
      handlers[entity.id] = () =>
        handleEntitySelect(entity.id, entity.display_name || entity.name)
    })
    return handlers
  }, [filteredEntities, handleEntitySelect])

  const handleClearEntity = useCallback(() => {
    handleInputChange('entityId', '')
    handleInputChange('entityName', '')
    setEntitySearchQuery('')
  }, [handleInputChange])

  const handleEntityInputFocus = useCallback(() => {
    setShowEntityDropdown(true)
  }, [])

  const handleEntityInputBlur = useCallback(() => {
    // Delay to allow click on dropdown items
    setTimeout(() => setShowEntityDropdown(false), 200)
  }, [])

  // Extracted EntityDropdown component to reduce JSX nesting
  const EntityDropdown: React.FC = () => (
    <div>
      <label
        htmlFor="txn-entity"
        className="block text-sm font-medium text-[#11202B] dark:text-[#9FB4BE] mb-2"
      >
        <div className="flex items-center">
          <Users className="w-4 h-4 mr-2" />
          Entity
        </div>
      </label>
      <div className="relative">
        <input
          id="txn-entity"
          type="text"
          value={entitySearchQuery}
          onChange={handleEntitySearchChange}
          onFocus={handleEntityInputFocus}
          onBlur={handleEntityInputBlur}
          className={`w-full px-4 py-2 border rounded-lg bg-[#F7FAFA] dark:bg-[#11202B] text-[#11202B] dark:text-[#EAF3F2] ${
            errors.entityId
              ? 'border-[#E8836F]'
              : 'border-[rgba(95,227,192,0.15)]'
          } focus:outline-none focus:ring-2 focus:ring-[#5FE3C0]`}
          placeholder="Search entity"
        />
        {entitySearchQuery && (
          <button
            type="button"
            onClick={handleClearEntity}
            className="absolute right-2 top-2 text-[#647D8B] hover:text-[#294050] dark:hover:text-[#9FB4BE]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {showEntityDropdown && (
          <ul className="absolute z-10 mt-1 w-full bg-[#F7FAFA] dark:bg-[#11202B] border border-[rgba(95,227,192,0.15)] rounded-md shadow-lg max-h-60 overflow-auto">
            {filteredEntities.map(entity => (
              <li key={entity.id}>
                <button
                  type="button"
                  onClick={entityClickHandlers[entity.id]}
                  className="w-full text-left px-4 py-2 hover:bg-[#EAF3F2] dark:hover:bg-[#16242F] cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[#11202B] dark:text-[#EAF3F2]">
                        {entity.display_name || entity.name}
                      </p>
                      <p className="text-xs text-[#294050] dark:text-[#9FB4BE]">
                        {entity.name}
                      </p>
                    </div>
                    <X className="w-4 h-4 text-[#647D8B]" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {errors.entityId && (
        <p className="mt-1 text-sm text-[#E8836F]">{errors.entityId}</p>
      )}
    </div>
  )

  const validateForm = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof TransactionFormData, string>> = {}

    if (!formData.date) newErrors.date = 'Date is required'
    if (!formData.description.trim())
      newErrors.description = 'Description is required'
    if (!formData.wallet) newErrors.wallet = 'Wallet is required'
    if (!formData.tokenId) newErrors.tokenId = 'Token is required'
    if (formData.amount <= 0) newErrors.amount = 'Amount must be greater than 0'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!validateForm()) {
        return
      }

      setIsSaving(true)

      try {
        if (isEditMode && id) {
          await updateTransaction(id, formData)
        } else {
          await addTransaction(formData)
        }
        navigate('/transactions')
      } catch (error) {
        console.error('Error saving transaction:', error)
      } finally {
        setIsSaving(false)
      }
    },
    [
      formData,
      isEditMode,
      id,
      validateForm,
      addTransaction,
      updateTransaction,
      navigate,
    ]
  )

  const handleCancel = useCallback(() => {
    navigate('/transactions')
  }, [navigate])

  return (
    <div className="min-h-screen bg-[#F7FAFA] dark:bg-[#0C141B] p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-[#F7FAFA] dark:bg-[#0C141B] rounded-lg shadow-sm border border-[rgba(95,227,192,0.15)]">
          <div className="px-6 py-4 border-b border-[rgba(95,227,192,0.15)]">
            <div className="flex items-center justify-between">
              <div>
                <h1>{isEditMode ? 'Edit Transaction' : 'New Transaction'}</h1>
                <p className="text-sm text-[#294050] dark:text-[#9FB4BE] mt-1">
                  {isEditMode
                    ? 'Update transaction details below'
                    : 'Enter all transaction details below'}
                </p>
              </div>
              <button
                onClick={handleCancel}
                className="p-2 text-[#647D8B] hover:text-[#294050] dark:hover:text-[#9FB4BE]"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="txn-date"
                  className="block text-sm font-medium text-[#11202B] dark:text-[#9FB4BE] mb-2"
                >
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    Date & Time
                  </div>
                </label>
                <DatePicker
                  id="txn-date"
                  showTime={{ format: 'HH:mm' }}
                  format="YYYY-MM-DD HH:mm"
                  value={parseDateToDayjs(formData.date)}
                  onChange={handleDateChange}
                  className="w-full"
                  status={errors.date ? 'error' : undefined}
                  allowClear={false}
                  placeholder="Select date and time"
                />
                {errors.date && (
                  <p className="mt-1 text-sm text-[#E8836F]">{errors.date}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="txn-wallet"
                  className="block text-sm font-medium text-[#11202B] dark:text-[#9FB4BE] mb-2"
                >
                  <div className="flex items-center">
                    <WalletIcon className="w-4 h-4 mr-2" />
                    Wallet
                  </div>
                </label>
                <select
                  id="txn-wallet"
                  value={formData.wallet}
                  onChange={handleWalletChange}
                  className={`w-full px-4 py-2 border rounded-lg bg-[#F7FAFA] dark:bg-[#11202B] text-[#11202B] dark:text-[#EAF3F2] ${
                    errors.wallet
                      ? 'border-[#E8836F]'
                      : 'border-[rgba(95,227,192,0.15)]'
                  } focus:outline-none focus:ring-2 focus:ring-[#5FE3C0]`}
                >
                  <option value="">Select wallet</option>
                  {walletOptions.length > 0 ? (
                    walletOptions.map(wallet => (
                      <option key={wallet.address} value={wallet.address}>
                        {wallet.displayName} - {wallet.walletType}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>
                      No wallets connected - go to Wallet Manager to connect
                    </option>
                  )}
                </select>
                {errors.wallet && (
                  <p className="mt-1 text-sm text-[#E8836F]">{errors.wallet}</p>
                )}
              </div>
            </div>

            <EntityDropdown />

            <div>
              <label
                htmlFor="txn-description"
                className="block text-sm font-medium text-[#11202B] dark:text-[#9FB4BE] mb-2"
              >
                <div className="flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  Description
                </div>
              </label>
              <input
                id="txn-description"
                type="text"
                value={formData.description}
                onChange={handleDescriptionChange}
                placeholder="Enter transaction description"
                className={`w-full px-4 py-2 border rounded-lg bg-[#F7FAFA] dark:bg-[#11202B] text-[#11202B] dark:text-[#EAF3F2] ${
                  errors.description
                    ? 'border-[#E8836F]'
                    : 'border-[rgba(95,227,192,0.15)]'
                } focus:outline-none focus:ring-2 focus:ring-[#5FE3C0]`}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-[#E8836F]">
                  {errors.description}
                </p>
              )}
            </div>

            <CounterpartySelector
              isTransferBetweenOwnWallets={isTransferBetweenOwnWallets}
              formData={formData}
              selectedEntity={selectedEntity}
              entitySearchQuery={entitySearchQuery}
              showEntityDropdown={showEntityDropdown}
              filteredEntities={filteredEntities}
              entityClickHandlers={entityClickHandlers}
              destinationWalletOptions={destinationWalletOptions}
              handleDestinationWalletChange={handleDestinationWalletChange}
              handleClearEntity={handleClearEntity}
              handleEntitySearchChange={handleEntitySearchChange}
              handleEntityInputFocus={handleEntityInputFocus}
              handleEntityInputBlur={handleEntityInputBlur}
            />

            <TransactionClassificationSection
              formData={formData}
              availableCategories={availableCategories}
              availableSubcategories={availableSubcategories}
              availableTransactionTypes={availableTransactionTypes}
              selectedTransactionType={selectedTransactionType}
              handleCategoryChange={handleCategoryChange}
              handleTransactionSubcategoryChange={handleTransactionSubcategoryChange}
              handleTransactionTypeCodeChange={handleTransactionTypeCodeChange}
            />

            <div>
              <TokenSelector
                selectedTokenId={formData.tokenId}
                selectedChainId={formData.chainId}
                onTokenSelect={handleTokenSelect}
                required
                error={errors.tokenId}
              />
              {selectedToken && (
                <div className="mt-2 p-3 bg-[#5FE3C0]/10 dark:bg-[#5FE3C0]/20 rounded-lg">
                  <div className="text-xs text-[#294050] dark:text-[#9CF1DC]">
                    <div>
                      <strong>Asset Type:</strong>{' '}
                      {
                        getDigitalAssetTypeInfo(selectedToken.digitalAssetType)
                          .name
                      }
                    </div>
                    <div>
                      <strong>Account:</strong>{' '}
                      {
                        getDigitalAssetTypeInfo(selectedToken.digitalAssetType)
                          .accountNumber
                      }
                    </div>
                    <div>
                      <strong>Chain:</strong> {selectedChain?.chainName}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <AmountSection
              formData={formData}
              errors={errors}
              selectedToken={selectedToken}
              currencySettings={currencySettings}
              handleAmountInputChange={handleAmountInputChange}
              handleFiatValueChange={handleFiatValueChange}
            />

            <div>
              <label
                htmlFor="txn-hash"
                className="block text-sm font-medium text-[#11202B] dark:text-[#9FB4BE] mb-2"
              >
                Transaction Hash (Optional)
              </label>
              <input
                id="txn-hash"
                type="text"
                value={formData.hash}
                onChange={handleHashChange}
                placeholder="0x..."
                className="w-full px-4 py-2 border border-[rgba(95,227,192,0.15)] rounded-lg bg-[#F7FAFA] dark:bg-[#11202B] text-[#11202B] dark:text-[#EAF3F2] focus:outline-none focus:ring-2 focus:ring-[#5FE3C0]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="txn-account-code"
                  className="block text-sm font-medium text-[#11202B] dark:text-[#9FB4BE] mb-2"
                >
                  Account Code (Optional)
                </label>
                <input
                  id="txn-account-code"
                  type="text"
                  value={formData.accountCode}
                  onChange={handleAccountCodeChange}
                  placeholder="e.g., 1000"
                  className="w-full px-4 py-2 border border-[rgba(95,227,192,0.15)] rounded-lg bg-[#F7FAFA] dark:bg-[#11202B] text-[#11202B] dark:text-[#EAF3F2] focus:outline-none focus:ring-2 focus:ring-[#5FE3C0]"
                />
              </div>

              <div>
                <label
                  htmlFor="txn-account-name"
                  className="block text-sm font-medium text-[#11202B] dark:text-[#9FB4BE] mb-2"
                >
                  Account Name (Optional)
                </label>
                <input
                  id="txn-account-name"
                  type="text"
                  value={formData.accountName}
                  onChange={handleAccountNameChange}
                  placeholder="e.g., Cash"
                  className="w-full px-4 py-2 border border-[rgba(95,227,192,0.15)] rounded-lg bg-[#F7FAFA] dark:bg-[#11202B] text-[#11202B] dark:text-[#EAF3F2] focus:outline-none focus:ring-2 focus:ring-[#5FE3C0]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="txn-memo"
                className="block text-sm font-medium text-[#11202B] dark:text-[#9FB4BE] mb-2"
              >
                Memo / Notes (Optional)
              </label>
              <textarea
                id="txn-memo"
                value={formData.memo}
                onChange={handleMemoChange}
                placeholder="Additional notes or comments about this transaction"
                rows={3}
                className="w-full px-4 py-2 border border-[rgba(95,227,192,0.15)] rounded-lg bg-[#F7FAFA] dark:bg-[#11202B] text-[#11202B] dark:text-[#EAF3F2] focus:outline-none focus:ring-2 focus:ring-[#5FE3C0]"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-6 border-t border-[rgba(95,227,192,0.15)]">
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2 border border-[rgba(95,227,192,0.15)] rounded-lg text-[#11202B] dark:text-[#9FB4BE] hover:bg-[#EAF3F2] dark:hover:bg-[#11202B]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center px-6 py-2 bg-[#294050] text-white rounded-lg hover:bg-[#1E2F3C] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving
                  ? 'Saving...'
                  : isEditMode
                    ? 'Update Transaction'
                    : 'Save Transaction'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default TransactionForm
