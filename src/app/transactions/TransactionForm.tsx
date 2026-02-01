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
  getAllCategories,
  getAllSubcategories,
  getTransactionTypesBySubcategory,
  getTransactionTypeByCode,
} from '../../types/transaction-categories'
import { StorageService } from '../../services/database/storageService'
import { ConnectedWallet } from '../../services/wallet/types'

const TransactionForm: React.FC = () => {
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

  useEffect(() => {
    if (!isEditMode) {
      setFormData(prev => ({
        ...prev,
        fiatCurrency: currencySettings.primaryCurrency,
      }))
    }
  }, [currencySettings.primaryCurrency, isEditMode])

  // Load connected wallets on mount
  useEffect(() => {
    const savedWallets = StorageService.loadWallets()
    setConnectedWallets(savedWallets)
  }, [])

  // Build wallet options from connected wallets
  const walletOptions = connectedWallets.flatMap(wallet =>
    wallet.accounts.map(acc => ({
      address: acc.address,
      name: acc.name || 'Unnamed',
      displayName: formatWalletDisplay(acc.address, acc.name),
      walletType: wallet.type,
    }))
  )

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

      const estimatedFiatValue = amount * 2500
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
      handleInputChange('transactionTypeCode', e.target.value)
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
        className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
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
          className={`w-full px-4 py-2 border rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] ${
            errors.entityId
              ? 'border-[#9d6b6b]'
              : 'border-[rgba(201,169,97,0.15)]'
          } focus:outline-none focus:ring-2 focus:ring-[#c9a961]`}
          placeholder="Search entity"
        />
        {entitySearchQuery && (
          <button
            type="button"
            onClick={handleClearEntity}
            className="absolute right-2 top-2 text-[#a39d94] hover:text-[#696557] dark:hover:text-[#b8b3ac]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {showEntityDropdown && (
          <ul className="absolute z-10 mt-1 w-full bg-[#fafaf8] dark:bg-[#1a1815] border border-[rgba(201,169,97,0.15)] rounded-md shadow-lg max-h-60 overflow-auto">
            {filteredEntities.map(entity => (
              <li key={entity.id}>
                <button
                  type="button"
                  onClick={entityClickHandlers[entity.id]}
                  className="w-full text-left px-4 py-2 hover:bg-[#f3f1ed] dark:hover:bg-[#2a2620] cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-[#1a1815] dark:text-[#f5f3f0]">
                        {entity.display_name || entity.name}
                      </p>
                      <p className="text-xs text-[#696557] dark:text-[#b8b3ac]">
                        {entity.name}
                      </p>
                    </div>
                    <X className="w-4 h-4 text-[#a39d94]" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {errors.entityId && (
        <p className="mt-1 text-sm text-[#9d6b6b]">{errors.entityId}</p>
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
    <div className="min-h-screen bg-[#fafaf8] dark:bg-[#0f0e0c] p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-[#fafaf8] dark:bg-[#0f0e0c] rounded-lg shadow-sm border border-[rgba(201,169,97,0.15)]">
          <div className="px-6 py-4 border-b border-[rgba(201,169,97,0.15)]">
            <div className="flex items-center justify-between">
              <div>
                <h1>{isEditMode ? 'Edit Transaction' : 'New Transaction'}</h1>
                <p className="text-sm text-[#696557] dark:text-[#b8b3ac] mt-1">
                  {isEditMode
                    ? 'Update transaction details below'
                    : 'Enter all transaction details below'}
                </p>
              </div>
              <button
                onClick={handleCancel}
                className="p-2 text-[#a39d94] hover:text-[#696557] dark:hover:text-[#b8b3ac]"
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
                  className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
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
                  <p className="mt-1 text-sm text-[#9d6b6b]">{errors.date}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="txn-wallet"
                  className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
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
                  className={`w-full px-4 py-2 border rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] ${
                    errors.wallet
                      ? 'border-[#9d6b6b]'
                      : 'border-[rgba(201,169,97,0.15)]'
                  } focus:outline-none focus:ring-2 focus:ring-[#c9a961]`}
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
                  <p className="mt-1 text-sm text-[#9d6b6b]">{errors.wallet}</p>
                )}
              </div>
            </div>

            <EntityDropdown />

            <div>
              <label
                htmlFor="txn-description"
                className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
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
                className={`w-full px-4 py-2 border rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] ${
                  errors.description
                    ? 'border-[#9d6b6b]'
                    : 'border-[rgba(201,169,97,0.15)]'
                } focus:outline-none focus:ring-2 focus:ring-[#c9a961]`}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-[#9d6b6b]">
                  {errors.description}
                </p>
              )}
            </div>

            {/* Entity/Counterparty Selector */}
            <div>
              <label
                htmlFor="txn-entity"
                className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
              >
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-2" />
                  Counterparty (Optional)
                </div>
              </label>
              <p className="text-xs text-gray-500 dark:text-[#a39d94] mb-2">
                Link this transaction to a vendor, customer, or other entity
              </p>

              {selectedEntity ? (
                <div className="flex items-center gap-2 p-3 bg-[#7a9b6f]/10 dark:bg-[#7a9b6f]/20 border border-[#7a9b6f]/30 dark:border-[#7a9b6f]/40 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-[#1a1815] dark:text-[#f5f3f0]">
                      {selectedEntity.display_name || selectedEntity.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-[#a39d94]">
                      {selectedEntity.entity_type.charAt(0).toUpperCase() +
                        selectedEntity.entity_type.slice(1)}
                      {selectedEntity.category &&
                        ` · ${selectedEntity.category}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearEntity}
                    className="p-1 text-[#a39d94] hover:text-[#696557] dark:hover:text-[#b8b3ac]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#a39d94]" />
                    <input
                      id="txn-entity"
                      type="text"
                      value={entitySearchQuery}
                      onChange={handleEntitySearchChange}
                      onFocus={handleEntityInputFocus}
                      onBlur={handleEntityInputBlur}
                      placeholder="Search entities by name..."
                      className="w-full pl-16 pr-4 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
                    />
                  </div>

                  {showEntityDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-[#fafaf8] dark:bg-[#1a1815] border border-[rgba(201,169,97,0.15)] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredEntities.length > 0 ? (
                        filteredEntities.map(entity => (
                          <button
                            key={entity.id}
                            type="button"
                            onClick={entityClickHandlers[entity.id]}
                            className="w-full px-4 py-2 text-left hover:bg-[#f3f1ed] dark:hover:bg-[#2a2620] flex items-center justify-between"
                          >
                            <div>
                              <div className="font-medium text-[#1a1815] dark:text-[#f5f3f0]">
                                {entity.display_name || entity.name}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-[#a39d94]">
                                {entity.entity_type.charAt(0).toUpperCase() +
                                  entity.entity_type.slice(1)}
                                {entity.category && ` · ${entity.category}`}
                              </div>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-center text-gray-500 dark:text-[#a39d94]">
                          <p className="text-sm">No entities found</p>
                          <a
                            href="/entities"
                            className="text-xs text-[#8b4e52] dark:text-[#a86e72] hover:underline inline-flex items-center gap-1 mt-1"
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

            {/* Comprehensive Transaction Type System */}
            <div className="space-y-4 p-4 bg-[#c9a961]/10 dark:bg-[#c9a961]/20 rounded-lg border border-[#c9a961]/30 dark:border-[#c9a961]/40">
              <h3 className="text-sm font-semibold text-[#8b4e52] dark:text-[#d4b87a] flex items-center">
                <Tag className="w-4 h-4 mr-2" />
                Transaction Classification
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="txn-category"
                    className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
                  >
                    Category
                  </label>
                  <select
                    id="txn-category"
                    value={formData.transactionCategory || ''}
                    onChange={handleCategoryChange}
                    className="w-full px-4 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
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
                    className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
                  >
                    Subcategory
                  </label>
                  <select
                    id="txn-subcategory"
                    value={formData.transactionSubcategory || ''}
                    onChange={handleTransactionSubcategoryChange}
                    disabled={!formData.transactionCategory}
                    className="w-full px-4 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:outline-none focus:ring-2 focus:ring-[#c9a961] disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
                  >
                    Transaction Type
                  </label>
                  <select
                    id="txn-type"
                    value={formData.transactionTypeCode || ''}
                    onChange={handleTransactionTypeCodeChange}
                    disabled={!formData.transactionSubcategory}
                    className="w-full px-4 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:outline-none focus:ring-2 focus:ring-[#c9a961] disabled:opacity-50 disabled:cursor-not-allowed"
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
                <div className="mt-4 p-3 bg-[#fafaf8] dark:bg-[#1a1815] rounded-lg border border-[rgba(201,169,97,0.15)]">
                  <h4 className="text-xs font-semibold text-[#1a1815] dark:text-[#b8b3ac] mb-2">
                    Suggested Accounts
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="font-medium text-[#7a9b6f] dark:text-[#8faf84]">
                        Debit:
                      </span>
                      <p className="text-[#1a1815] dark:text-[#f5f3f0] mt-1">
                        {selectedTransactionType.debitAccounts}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-[#9d6b6b] dark:text-[#b88585]">
                        Credit:
                      </span>
                      <p className="text-[#1a1815] dark:text-[#f5f3f0] mt-1">
                        {selectedTransactionType.creditAccounts}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <TokenSelector
                selectedTokenId={formData.tokenId}
                selectedChainId={formData.chainId}
                onTokenSelect={handleTokenSelect}
                required
                error={errors.tokenId}
              />
              {selectedToken && (
                <div className="mt-2 p-3 bg-[#c9a961]/10 dark:bg-[#c9a961]/20 rounded-lg">
                  <div className="text-xs text-[#8b4e52] dark:text-[#d4b87a]">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="txn-amount"
                  className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
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
                  className={`w-full px-4 py-2 border rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] ${
                    errors.amount
                      ? 'border-[#9d6b6b]'
                      : 'border-[rgba(201,169,97,0.15)]'
                  } focus:outline-none focus:ring-2 focus:ring-[#c9a961]`}
                />
                {errors.amount && (
                  <p className="mt-1 text-sm text-[#9d6b6b]">{errors.amount}</p>
                )}
                {selectedToken && (
                  <p className="mt-1 text-xs text-[#696557] dark:text-[#b8b3ac]">
                    {selectedToken.symbol} ({selectedToken.decimals} decimals)
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="txn-fiat-value"
                  className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
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
                  className="w-full px-4 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="txn-hash"
                className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
              >
                Transaction Hash (Optional)
              </label>
              <input
                id="txn-hash"
                type="text"
                value={formData.hash}
                onChange={handleHashChange}
                placeholder="0x..."
                className="w-full px-4 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="txn-account-code"
                  className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
                >
                  Account Code (Optional)
                </label>
                <input
                  id="txn-account-code"
                  type="text"
                  value={formData.accountCode}
                  onChange={handleAccountCodeChange}
                  placeholder="e.g., 1000"
                  className="w-full px-4 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
                />
              </div>

              <div>
                <label
                  htmlFor="txn-account-name"
                  className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
                >
                  Account Name (Optional)
                </label>
                <input
                  id="txn-account-name"
                  type="text"
                  value={formData.accountName}
                  onChange={handleAccountNameChange}
                  placeholder="e.g., Cash"
                  className="w-full px-4 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="txn-memo"
                className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-2"
              >
                Memo / Notes (Optional)
              </label>
              <textarea
                id="txn-memo"
                value={formData.memo}
                onChange={handleMemoChange}
                placeholder="Additional notes or comments about this transaction"
                rows={3}
                className="w-full px-4 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg bg-[#fafaf8] dark:bg-[#1a1815] text-[#1a1815] dark:text-[#f5f3f0] focus:outline-none focus:ring-2 focus:ring-[#c9a961]"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-6 border-t border-[rgba(201,169,97,0.15)]">
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2 border border-[rgba(201,169,97,0.15)] rounded-lg text-[#1a1815] dark:text-[#b8b3ac] hover:bg-[#f3f1ed] dark:hover:bg-[#1a1815]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center px-6 py-2 bg-[#8b4e52] text-white rounded-lg hover:bg-[#7a4248] disabled:opacity-50 disabled:cursor-not-allowed"
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
