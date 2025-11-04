import React, { useState, useCallback, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Save, X, Calendar, DollarSign, FileText, Tag, Wallet as WalletIcon, ArrowRight } from 'lucide-react'
import { useTransactions } from '../../contexts/TransactionContext'
import { useCurrency } from '../../contexts/CurrencyContext'
import { useTokens } from '../../contexts/TokenContext'
import { TransactionFormData, TransactionType } from '../../types/transaction'
import { Token, Chain } from '../../types/digitalAssets'
import { getDigitalAssetTypeInfo } from '../../types/digitalAssets'
import TokenSelector from '../../components/common/TokenSelector'
import {
  TransactionCategory,
  getAllCategories,
  getAllSubcategories,
  getTransactionTypesBySubcategory,
  getTransactionTypeByCode
} from '../../types/transaction-categories'

const TransactionForm: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const { addTransaction, updateTransaction, getTransaction } = useTransactions()
  const { settings: currencySettings } = useCurrency()
  const { getToken, getChain } = useTokens()

  const isEditMode = Boolean(id)
  const existingTransaction = id ? getTransaction(id) : undefined

  const [formData, setFormData] = useState<TransactionFormData>({
    date: existingTransaction?.date || new Date().toISOString().slice(0, 16),
    description: existingTransaction?.description || '',
    type: existingTransaction?.type || 'revenue',
    category: existingTransaction?.category || '',
    wallet: existingTransaction?.wallet || '',
    tokenId: existingTransaction?.tokenId || '',
    chainId: existingTransaction?.chainId || '',
    amount: existingTransaction?.amount || 0,
    fiatValue: existingTransaction?.fiatValue || 0,
    fiatCurrency: existingTransaction?.fiatCurrency || currencySettings.primaryCurrency,
    hash: existingTransaction?.hash || '',
    accountCode: existingTransaction?.accountCode || '',
    accountName: existingTransaction?.accountName || '',
    digitalAssetType: existingTransaction?.digitalAssetType || '',
    memo: existingTransaction?.memo || '',
    crypto: existingTransaction?.crypto,
  })

  const [errors, setErrors] = useState<Partial<Record<keyof TransactionFormData, string>>>({})
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!isEditMode) {
      setFormData(prev => ({
        ...prev,
        fiatCurrency: currencySettings.primaryCurrency
      }))
    }
  }, [currencySettings.primaryCurrency, isEditMode])

  const availableWallets = ['Main Wallet', 'Operating Wallet', 'Cold Storage', 'Hot Wallet', 'Warm Wallet']

  const selectedToken = formData.tokenId ? getToken(formData.tokenId) : undefined
  const selectedChain = formData.chainId ? getChain(formData.chainId) : undefined

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

  const handleInputChange = useCallback((field: keyof TransactionFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }, [errors])

  const handleTokenSelect = useCallback((token: Token, chain: Chain) => {
    setFormData(prev => ({
      ...prev,
      tokenId: token.id,
      chainId: chain.chainId,
      digitalAssetType: token.digitalAssetType,
      accountCode: getDigitalAssetTypeInfo(token.digitalAssetType).accountNumber,
      accountName: getDigitalAssetTypeInfo(token.digitalAssetType).name,
    }))
    if (errors.tokenId) {
      setErrors(prev => ({ ...prev, tokenId: undefined }))
    }
  }, [errors.tokenId])

  const handleAmountChange = useCallback((value: string) => {
    const amount = parseFloat(value) || 0
    handleInputChange('amount', amount)

    const estimatedFiatValue = amount * 2500
    handleInputChange('fiatValue', estimatedFiatValue)
  }, [handleInputChange])

  const validateForm = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof TransactionFormData, string>> = {}

    if (!formData.date) newErrors.date = 'Date is required'
    if (!formData.description.trim()) newErrors.description = 'Description is required'
    if (!formData.wallet) newErrors.wallet = 'Wallet is required'
    if (!formData.tokenId) newErrors.tokenId = 'Token is required'
    if (formData.amount <= 0) newErrors.amount = 'Amount must be greater than 0'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
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
  }, [formData, isEditMode, id, validateForm, addTransaction, updateTransaction, navigate])

  const handleCancel = useCallback(() => {
    navigate('/transactions')
  }, [navigate])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {isEditMode ? 'Edit Transaction' : 'New Transaction'}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {isEditMode
                    ? 'Update transaction details below'
                    : 'Enter all transaction details below'}
                </p>
              </div>
              <button
                onClick={handleCancel}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    Date & Time
                  </div>
                </label>
                <input
                  type="datetime-local"
                  value={formData.date}
                  onChange={e => handleInputChange('date', e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                    errors.date
                      ? 'border-red-500'
                      : 'border-gray-300 dark:border-gray-600'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                {errors.date && (
                  <p className="mt-1 text-sm text-red-600">{errors.date}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <div className="flex items-center">
                    <WalletIcon className="w-4 h-4 mr-2" />
                    Wallet
                  </div>
                </label>
                <select
                  value={formData.wallet}
                  onChange={e => handleInputChange('wallet', e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                    errors.wallet
                      ? 'border-red-500'
                      : 'border-gray-300 dark:border-gray-600'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                >
                  <option value="">Select wallet</option>
                  {availableWallets.map(wallet => (
                    <option key={wallet} value={wallet}>
                      {wallet}
                    </option>
                  ))}
                </select>
                {errors.wallet && (
                  <p className="mt-1 text-sm text-red-600">{errors.wallet}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <div className="flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  Description
                </div>
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={e => handleInputChange('description', e.target.value)}
                placeholder="Enter transaction description"
                className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                  errors.description
                    ? 'border-red-500'
                    : 'border-gray-300 dark:border-gray-600'
                } focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description}</p>
              )}
            </div>

            {/* Comprehensive Transaction Type System */}
            <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 flex items-center">
                <Tag className="w-4 h-4 mr-2" />
                Transaction Classification
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Category
                  </label>
                  <select
                    value={formData.transactionCategory || ''}
                    onChange={e => {
                      handleInputChange('transactionCategory', e.target.value)
                      handleInputChange('transactionSubcategory', '')
                      handleInputChange('transactionTypeCode', '')
                    }}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Subcategory
                  </label>
                  <select
                    value={formData.transactionSubcategory || ''}
                    onChange={e => {
                      handleInputChange('transactionSubcategory', e.target.value)
                      handleInputChange('transactionTypeCode', '')
                    }}
                    disabled={!formData.transactionCategory}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Transaction Type
                  </label>
                  <select
                    value={formData.transactionTypeCode || ''}
                    onChange={e => handleInputChange('transactionTypeCode', e.target.value)}
                    disabled={!formData.transactionSubcategory}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Suggested Accounts</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="font-medium text-green-700 dark:text-green-400">Debit:</span>
                      <p className="text-gray-900 dark:text-gray-100 mt-1">{selectedTransactionType.debitAccounts}</p>
                    </div>
                    <div>
                      <span className="font-medium text-red-700 dark:text-red-400">Credit:</span>
                      <p className="text-gray-900 dark:text-gray-100 mt-1">{selectedTransactionType.creditAccounts}</p>
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
                <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-xs text-blue-800 dark:text-blue-300">
                    <div><strong>Asset Type:</strong> {getDigitalAssetTypeInfo(selectedToken.digitalAssetType).name}</div>
                    <div><strong>Account:</strong> {getDigitalAssetTypeInfo(selectedToken.digitalAssetType).accountNumber}</div>
                    <div><strong>Chain:</strong> {selectedChain?.chainName}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <div className="flex items-center">
                    <DollarSign className="w-4 h-4 mr-2" />
                    Amount
                  </div>
                </label>
                <input
                  type="number"
                  step="0.000001"
                  value={formData.amount}
                  onChange={e => handleAmountChange(e.target.value)}
                  placeholder="0.00"
                  className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                    errors.amount
                      ? 'border-red-500'
                      : 'border-gray-300 dark:border-gray-600'
                  } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                />
                {errors.amount && (
                  <p className="mt-1 text-sm text-red-600">{errors.amount}</p>
                )}
                {selectedToken && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {selectedToken.symbol} ({selectedToken.decimals} decimals)
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {currencySettings.primaryCurrency} Value
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.fiatValue}
                  onChange={e => handleInputChange('fiatValue', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Transaction Hash (Optional)
              </label>
              <input
                type="text"
                value={formData.hash}
                onChange={e => handleInputChange('hash', e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Account Code (Optional)
                </label>
                <input
                  type="text"
                  value={formData.accountCode}
                  onChange={e => handleInputChange('accountCode', e.target.value)}
                  placeholder="e.g., 1000"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Account Name (Optional)
                </label>
                <input
                  type="text"
                  value={formData.accountName}
                  onChange={e => handleInputChange('accountName', e.target.value)}
                  placeholder="e.g., Cash"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Memo / Notes (Optional)
              </label>
              <textarea
                value={formData.memo}
                onChange={e => handleInputChange('memo', e.target.value)}
                placeholder="Additional notes or comments about this transaction"
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Saving...' : isEditMode ? 'Update Transaction' : 'Save Transaction'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default TransactionForm
