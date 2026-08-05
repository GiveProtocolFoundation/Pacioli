import React, { useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import {
  Shield,
  Plus,
  GripVertical,
  ToggleLeft,
  ToggleRight,
  Pencil,
  Trash2,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Package,
  AlertCircle,
} from 'lucide-react'

interface ClassificationRule {
  id: string
  name: string
  description: string
  matchTxTypes: string
  matchChains: string
  matchSelfTransfer: string
  debitAccount: string
  creditAccount: string
  debitLineDesc: string
  creditLineDesc: string
  jeDescription: string
  useFeeAmount: boolean
  priority: number
  enabled: boolean
  source: string
  sourceKind: string
  matchPayeePattern: string
  matchAmountSign: string
  createdAt: string
  updatedAt: string
}

type SourceKindFilter = 'all' | 'crypto' | 'bank'

interface RuleFormData {
  name: string
  description: string
  matchTxTypes: string
  matchChains: string
  matchSelfTransfer: string
  debitAccount: string
  creditAccount: string
  debitLineDesc: string
  creditLineDesc: string
  jeDescription: string
  useFeeAmount: boolean
  sourceKind: string
  matchPayeePattern: string
  matchAmountSign: string
}

const TX_TYPES = [
  'transfer',
  'swap',
  'bridge',
  'stake',
  'unstake',
  'claim',
  'mint',
  'burn',
  'approve',
  'contract_call',
  'unknown',
]

const SELF_TRANSFER_OPTIONS = [
  { value: 'any', label: 'Any' },
  { value: 'true', label: 'Self-transfer only' },
  { value: 'false', label: 'External only' },
]

const AMOUNT_SIGN_OPTIONS = [
  { value: 'any', label: 'Any' },
  { value: 'negative', label: 'Withdrawals (negative)' },
  { value: 'positive', label: 'Deposits (positive)' },
]

const SOURCE_KIND_OPTIONS = [
  { value: 'crypto', label: 'Crypto' },
  { value: 'bank', label: 'Bank' },
  { value: 'any', label: 'Both' },
]

const INPUT_CLASS =
  'w-full px-3 py-2 border border-[rgba(95,227,192,0.15)] rounded-lg bg-white dark:bg-[#0C141B] text-[#11202B] dark:text-[#EAF3F2] placeholder-[#647D8B] focus:outline-none focus:ring-2 focus:ring-[#5FE3C0] focus:border-[#5FE3C0] text-sm'

const LABEL_CLASS =
  'block text-xs font-medium text-[#294050] dark:text-[#9FB4BE] mb-1'

const emptyForm: RuleFormData = {
  name: '',
  description: '',
  matchTxTypes: '',
  matchChains: '',
  matchSelfTransfer: 'any',
  debitAccount: '',
  creditAccount: '',
  debitLineDesc: '',
  creditLineDesc: '',
  jeDescription: '',
  useFeeAmount: false,
  sourceKind: 'crypto',
  matchPayeePattern: '',
  matchAmountSign: 'any',
}

const emptyBankForm: RuleFormData = {
  ...emptyForm,
  sourceKind: 'bank',
  matchTxTypes: '',
}

interface RuleFormProps {
  data: RuleFormData
  onChange: (data: RuleFormData) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
}

/** @returns Form for creating or editing a single classification rule. */
const RuleForm: React.FC<RuleFormProps> = ({
  data,
  onChange,
  onSave,
  onCancel,
  saving,
}) => {
  const handleFieldChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const field = event.currentTarget.dataset.field as
        | keyof RuleFormData
        | undefined
      if (!field) return
      onChange({ ...data, [field]: event.target.value })
    },
    [data, onChange]
  )

  const handleCheckboxChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const field = event.currentTarget.dataset.field as
        | keyof RuleFormData
        | undefined
      if (!field) return
      onChange({ ...data, [field]: event.target.checked })
    },
    [data, onChange]
  )

  const handleToggleTxType = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const txType = event.currentTarget.dataset.txtype
      if (!txType) return
      const types = data.matchTxTypes
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
      if (types.includes(txType)) {
        onChange({
          ...data,
          matchTxTypes: types.filter(x => x !== txType).join(','),
        })
      } else {
        onChange({ ...data, matchTxTypes: [...types, txType].join(',') })
      }
    },
    [data, onChange]
  )

  const isBankRule = data.sourceKind === 'bank'
  const valid =
    data.name.trim() !== '' &&
    (isBankRule
      ? data.matchPayeePattern.trim() !== ''
      : data.matchTxTypes.trim() !== '') &&
    (data.debitAccount.trim() !== '' || data.creditAccount.trim() !== '')

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={LABEL_CLASS}>Name *</label>
          <input
            className={INPUT_CLASS}
            data-field="name"
            value={data.name}
            onChange={handleFieldChange}
            placeholder={
              isBankRule ? 'e.g. Payroll — Gusto' : 'e.g. Staking Reward'
            }
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Description</label>
          <input
            className={INPUT_CLASS}
            data-field="description"
            value={data.description}
            onChange={handleFieldChange}
            placeholder="Optional description"
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Source Kind</label>
          <select
            className={INPUT_CLASS}
            data-field="sourceKind"
            value={data.sourceKind}
            onChange={handleFieldChange}
          >
            {SOURCE_KIND_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isBankRule ? (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={LABEL_CLASS}>
              Payee Pattern * (pipe-separated)
            </label>
            <input
              className={INPUT_CLASS}
              data-field="matchPayeePattern"
              value={data.matchPayeePattern}
              onChange={handleFieldChange}
              placeholder="e.g. gusto|rippling|adp"
            />
            <p className="mt-0.5 text-[10px] text-[#647D8B]">
              Case-insensitive substring match. Use | for alternatives.
            </p>
          </div>
          <div>
            <label className={LABEL_CLASS}>Amount Sign</label>
            <select
              className={INPUT_CLASS}
              data-field="matchAmountSign"
              value={data.matchAmountSign}
              onChange={handleFieldChange}
            >
              {AMOUNT_SIGN_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS}>JE Description ({'{payee}'})</label>
            <input
              className={INPUT_CLASS}
              data-field="jeDescription"
              value={data.jeDescription}
              onChange={handleFieldChange}
              placeholder="e.g. Payroll via {payee}"
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={LABEL_CLASS}>
              Match Tx Types * (comma-separated)
            </label>
            <input
              className={INPUT_CLASS}
              data-field="matchTxTypes"
              value={data.matchTxTypes}
              onChange={handleFieldChange}
              placeholder="e.g. claim,stake"
            />
            <div className="mt-1 flex flex-wrap gap-1">
              {TX_TYPES.map(txTypeOption => (
                <button
                  key={txTypeOption}
                  type="button"
                  data-txtype={txTypeOption}
                  onClick={handleToggleTxType}
                  className={`px-1.5 py-0.5 text-[10px] rounded border transition-colors ${
                    data.matchTxTypes
                      .split(',')
                      .map(s => s.trim())
                      .includes(txTypeOption)
                      ? 'bg-[#5FE3C0]/20 border-[#5FE3C0]/40 text-[#294050] dark:text-[#5FE3C0]'
                      : 'border-[rgba(95,227,192,0.15)] text-[#647D8B] hover:bg-[#294050]/5'
                  }`}
                >
                  {txTypeOption}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={LABEL_CLASS}>Match Chains (empty = all)</label>
            <input
              className={INPUT_CLASS}
              data-field="matchChains"
              value={data.matchChains}
              onChange={handleFieldChange}
              placeholder="e.g. polkadot,kusama"
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Self-Transfer Filter</label>
            <select
              className={INPUT_CLASS}
              data-field="matchSelfTransfer"
              value={data.matchSelfTransfer}
              onChange={handleFieldChange}
            >
              {SELF_TRANSFER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL_CLASS}>
            Debit Account #{isBankRule ? ' (empty = bank acct)' : ' *'}
          </label>
          <input
            className={INPUT_CLASS}
            data-field="debitAccount"
            value={data.debitAccount}
            onChange={handleFieldChange}
            placeholder={isBankRule ? 'e.g. 6100 (empty = bank)' : 'e.g. 1200'}
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>
            Credit Account #{isBankRule ? ' (empty = bank acct)' : ' *'}
          </label>
          <input
            className={INPUT_CLASS}
            data-field="creditAccount"
            value={data.creditAccount}
            onChange={handleFieldChange}
            placeholder={isBankRule ? 'e.g. 4000 (empty = bank)' : 'e.g. 4100'}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL_CLASS}>Debit Line Description</label>
          <input
            className={INPUT_CLASS}
            data-field="debitLineDesc"
            value={data.debitLineDesc}
            onChange={handleFieldChange}
            placeholder="e.g. Staking reward received"
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Credit Line Description</label>
          <input
            className={INPUT_CLASS}
            data-field="creditLineDesc"
            value={data.creditLineDesc}
            onChange={handleFieldChange}
            placeholder="e.g. Staking reward income"
          />
        </div>
      </div>
      {!isBankRule && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>
              JE Description Template ({'{chain}'}, {'{hash}'}, {'{type}'})
            </label>
            <input
              className={INPUT_CLASS}
              data-field="jeDescription"
              value={data.jeDescription}
              onChange={handleFieldChange}
              placeholder="e.g. Staking reward on {chain}"
            />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm text-[#294050] dark:text-[#9FB4BE] cursor-pointer">
              <input
                type="checkbox"
                data-field="useFeeAmount"
                checked={data.useFeeAmount}
                onChange={handleCheckboxChange}
                className="rounded border-[rgba(95,227,192,0.3)] text-[#5FE3C0] focus:ring-[#5FE3C0]"
              />
              Use fee amount (instead of transfer value)
            </label>
          </div>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-[rgba(95,227,192,0.15)] rounded-lg text-[#294050] dark:text-[#9FB4BE] hover:bg-[#EAF3F2] dark:hover:bg-[#16242F] transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={!valid || saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-[#294050] text-white hover:bg-[#1E2F3C] disabled:opacity-50 transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
          {saving ? 'Saving...' : 'Save Rule'}
        </button>
      </div>
    </div>
  )
}

interface RuleDisplayRowProps {
  rule: ClassificationRule
  index: number
  rulesCount: number
  onToggle: (event: React.MouseEvent<HTMLButtonElement>) => void
  onEdit: (event: React.MouseEvent<HTMLButtonElement>) => void
  onDelete: (event: React.MouseEvent<HTMLButtonElement>) => void
  onMoveUp: (event: React.MouseEvent<HTMLButtonElement>) => void
  onMoveDown: (event: React.MouseEvent<HTMLButtonElement>) => void
}

/** @returns Read-only display of a single classification rule with actions. */
const RuleDisplayRow: React.FC<RuleDisplayRowProps> = ({
  rule,
  index,
  rulesCount,
  onToggle,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}) => (
  <div className="p-4 flex items-start gap-3">
    <div className="flex flex-col items-center gap-0.5 pt-1">
      <GripVertical className="w-4 h-4 text-[#647D8B] cursor-grab mb-0.5" />
      <button
        data-index={index}
        onClick={onMoveUp}
        disabled={index === 0}
        className="p-0.5 hover:bg-[#294050]/10 rounded disabled:opacity-30 transition-colors"
      >
        <ChevronUp className="w-3 h-3 text-[#647D8B]" />
      </button>
      <button
        data-index={index}
        onClick={onMoveDown}
        disabled={index === rulesCount - 1}
        className="p-0.5 hover:bg-[#294050]/10 rounded disabled:opacity-30 transition-colors"
      >
        <ChevronDown className="w-3 h-3 text-[#647D8B]" />
      </button>
    </div>

    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-sm font-semibold text-[#11202B] dark:text-[#EAF3F2]">
          {rule.name}
        </h3>
        {rule.source === 'builtin' && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#5FE3C0]/15 text-[#294050] dark:text-[#5FE3C0]">
            Built-in
          </span>
        )}
        <span className="text-[10px] font-mono text-[#647D8B]">
          #{index + 1}
        </span>
      </div>
      {rule.description && (
        <p className="text-xs text-[#647D8B] mb-2">{rule.description}</p>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#294050] dark:text-[#9FB4BE]">
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
            rule.sourceKind === 'bank'
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
              : rule.sourceKind === 'any'
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                : 'bg-[#5FE3C0]/15 text-[#294050] dark:text-[#5FE3C0]'
          }`}
        >
          {rule.sourceKind === 'bank'
            ? 'Bank'
            : rule.sourceKind === 'any'
              ? 'Both'
              : 'Crypto'}
        </span>
        {rule.sourceKind === 'bank' || rule.sourceKind === 'any' ? (
          <>
            {Boolean(rule.matchPayeePattern) && (
              <span className="font-semibold">
                Payee: {rule.matchPayeePattern}
              </span>
            )}
            {rule.matchAmountSign !== 'any' && (
              <span className="font-semibold">
                Sign:{' '}
                {rule.matchAmountSign === 'negative'
                  ? '− withdrawal'
                  : '+ deposit'}
              </span>
            )}
          </>
        ) : (
          <>
            <span className="font-semibold">
              Match:{' '}
              {rule.matchTxTypes
                .split(',')
                .map(typeStr => typeStr.trim())
                .join(', ')}
            </span>
            {Boolean(rule.matchChains) && (
              <span className="font-semibold">Chains: {rule.matchChains}</span>
            )}
            {rule.matchSelfTransfer !== 'any' && (
              <span className="font-semibold">
                Self-xfer: {rule.matchSelfTransfer}
              </span>
            )}
          </>
        )}
        <span className="font-semibold">
          DR {rule.debitAccount || '(bank)'} / CR{' '}
          {rule.creditAccount || '(bank)'}
        </span>
        {Boolean(rule.useFeeAmount) && (
          <span className="text-amber-600 dark:text-amber-400">Fee amount</span>
        )}
      </div>
    </div>

    <div className="flex items-center gap-1">
      <button
        data-ruleid={rule.id}
        data-enabled={String(rule.enabled)}
        onClick={onToggle}
        className="p-1.5 hover:bg-[#294050]/10 dark:hover:bg-[#294050]/20 rounded transition-colors"
        title={rule.enabled ? 'Disable rule' : 'Enable rule'}
      >
        {rule.enabled ? (
          <ToggleRight className="w-5 h-5 text-[#5FE3C0]" />
        ) : (
          <ToggleLeft className="w-5 h-5 text-[#647D8B]" />
        )}
      </button>
      <button
        data-ruleid={rule.id}
        onClick={onEdit}
        className="p-1.5 hover:bg-[#294050]/10 dark:hover:bg-[#294050]/20 rounded transition-colors"
        title="Edit rule"
      >
        <Pencil className="w-4 h-4 text-[#647D8B]" />
      </button>
      <button
        data-ruleid={rule.id}
        onClick={onDelete}
        className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
        title="Delete rule"
      >
        <Trash2 className="w-4 h-4 text-red-500" />
      </button>
    </div>
  </div>
)

/** @returns Classification rules management page with CRUD, drag-reorder, and starter packs. */
const ClassificationRules: React.FC = () => {
  const [rules, setRules] = useState<ClassificationRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [formData, setFormData] = useState<RuleFormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [installingPack, setInstallingPack] = useState(false)
  const [sourceFilter, setSourceFilter] = useState<SourceKindFilter>('all')

  const fetchRules = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await invoke<ClassificationRule[]>(
        'list_classification_rules'
      )
      setRules(data)
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to load rules')
    } finally {
      setLoading(false)
    }
  }, [])

  const [autoInstallDone, setAutoInstallDone] = useState(false)

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  useEffect(() => {
    if (!loading && rules.length === 0 && !autoInstallDone) {
      setAutoInstallDone(true)
      invoke<number>('install_starter_rules')
        .then(count => {
          if (count > 0) fetchRules()
        })
        .catch(() => {
          /* skipcq: JS-0321 — auto-install is best-effort */
        })
    }
  }, [loading, rules.length, autoInstallDone, fetchRules])

  const handleInstallStarterPack = useCallback(async () => {
    setInstallingPack(true)
    setActionError(null)
    try {
      const count = await invoke<number>('install_starter_rules')
      if (count > 0) {
        await fetchRules()
      } else {
        setActionError('Starter rules already installed')
      }
    } catch (err) {
      setActionError(
        typeof err === 'string' ? err : 'Failed to install starter rules'
      )
    } finally {
      setInstallingPack(false)
    }
  }, [fetchRules])

  const handleToggle = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      const id = event.currentTarget.dataset.ruleid
      const enabled = event.currentTarget.dataset.enabled === 'true'
      if (!id) return
      setActionError(null)
      try {
        await invoke('toggle_classification_rule', { id, enabled: !enabled })
        setRules(prev =>
          prev.map(r => (r.id === id ? { ...r, enabled: !enabled } : r))
        )
      } catch (err) {
        setActionError(typeof err === 'string' ? err : 'Failed to toggle rule')
      }
    },
    []
  )

  const handleDelete = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      const id = event.currentTarget.dataset.ruleid
      if (!id) return
      setActionError(null)
      try {
        await invoke('delete_classification_rule', { id })
        setRules(prev => prev.filter(r => r.id !== id))
      } catch (err) {
        setActionError(typeof err === 'string' ? err : 'Failed to delete rule')
      }
    },
    []
  )

  const handleEdit = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const id = event.currentTarget.dataset.ruleid
      if (!id) return
      const rule = rules.find(r => r.id === id)
      if (!rule) return
      setEditingId(rule.id)
      setShowNewForm(false)
      setFormData({
        name: rule.name,
        description: rule.description,
        matchTxTypes: rule.matchTxTypes,
        matchChains: rule.matchChains,
        matchSelfTransfer: rule.matchSelfTransfer,
        debitAccount: rule.debitAccount,
        creditAccount: rule.creditAccount,
        debitLineDesc: rule.debitLineDesc,
        creditLineDesc: rule.creditLineDesc,
        jeDescription: rule.jeDescription,
        useFeeAmount: rule.useFeeAmount,
        sourceKind: rule.sourceKind,
        matchPayeePattern: rule.matchPayeePattern,
        matchAmountSign: rule.matchAmountSign,
      })
    },
    [rules]
  )

  const handleNewRule = useCallback(() => {
    setShowNewForm(true)
    setEditingId(null)
    setFormData(sourceFilter === 'bank' ? emptyBankForm : emptyForm)
  }, [sourceFilter])

  const handleCancelEdit = useCallback(() => {
    setEditingId(null)
    setShowNewForm(false)
    setFormData(emptyForm)
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setActionError(null)
    try {
      if (editingId) {
        await invoke('update_classification_rule', {
          id: editingId,
          input: {
            name: formData.name,
            description: formData.description,
            matchTxTypes: formData.matchTxTypes,
            matchChains: formData.matchChains,
            matchSelfTransfer: formData.matchSelfTransfer,
            debitAccount: formData.debitAccount,
            creditAccount: formData.creditAccount,
            debitLineDesc: formData.debitLineDesc,
            creditLineDesc: formData.creditLineDesc,
            jeDescription: formData.jeDescription,
            useFeeAmount: formData.useFeeAmount,
            sourceKind: formData.sourceKind,
            matchPayeePattern: formData.matchPayeePattern,
            matchAmountSign: formData.matchAmountSign,
          },
        })
      } else {
        await invoke('create_classification_rule', {
          input: {
            name: formData.name,
            description: formData.description || null,
            matchTxTypes: formData.matchTxTypes || '',
            matchChains: formData.matchChains || null,
            matchSelfTransfer: formData.matchSelfTransfer || null,
            debitAccount: formData.debitAccount,
            creditAccount: formData.creditAccount,
            debitLineDesc: formData.debitLineDesc || null,
            creditLineDesc: formData.creditLineDesc || null,
            jeDescription: formData.jeDescription || null,
            useFeeAmount: formData.useFeeAmount,
            sourceKind: formData.sourceKind,
            matchPayeePattern: formData.matchPayeePattern || null,
            matchAmountSign: formData.matchAmountSign || null,
          },
        })
      }
      setEditingId(null)
      setShowNewForm(false)
      setFormData(emptyForm)
      await fetchRules()
    } catch (err) {
      setActionError(typeof err === 'string' ? err : 'Failed to save rule')
    } finally {
      setSaving(false)
    }
  }, [editingId, formData, fetchRules])

  const handleMoveUp = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      const index = Number(event.currentTarget.dataset.index)
      if (Number.isNaN(index) || index === 0) return
      const newRules = [...rules]
      const temp = newRules[index]
      newRules[index] = newRules[index - 1]
      newRules[index - 1] = temp
      setRules(newRules)
      try {
        await invoke('reorder_classification_rules', {
          ruleIds: newRules.map(r => r.id),
        })
      } catch (err) {
        setActionError(
          typeof err === 'string' ? err : 'Failed to reorder rules'
        )
        await fetchRules()
      }
    },
    [rules, fetchRules]
  )

  const handleMoveDown = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      const index = Number(event.currentTarget.dataset.index)
      if (Number.isNaN(index) || index >= rules.length - 1) return
      const newRules = [...rules]
      const temp = newRules[index]
      newRules[index] = newRules[index + 1]
      newRules[index + 1] = temp
      setRules(newRules)
      try {
        await invoke('reorder_classification_rules', {
          ruleIds: newRules.map(r => r.id),
        })
      } catch (err) {
        setActionError(
          typeof err === 'string' ? err : 'Failed to reorder rules'
        )
        await fetchRules()
      }
    },
    [rules, fetchRules]
  )

  const handleDragStart = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      const index = Number(event.currentTarget.dataset.index)
      if (!Number.isNaN(index)) setDragIndex(index)
    },
    []
  )

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      const index = Number(event.currentTarget.dataset.index)
      if (Number.isNaN(index) || dragIndex === null || dragIndex === index)
        return
      const newRules = [...rules]
      const dragged = newRules.splice(dragIndex, 1)[0]
      newRules.splice(index, 0, dragged)
      setRules(newRules)
      setDragIndex(index)
    },
    [dragIndex, rules]
  )

  const handleDragEnd = useCallback(async () => {
    setDragIndex(null)
    try {
      await invoke('reorder_classification_rules', {
        ruleIds: rules.map(r => r.id),
      })
    } catch (err) {
      setActionError(typeof err === 'string' ? err : 'Failed to reorder rules')
      await fetchRules()
    }
  }, [rules, fetchRules])

  const builtinCount = rules.filter(r => r.source === 'builtin').length
  const enabledCount = rules.filter(r => r.enabled).length
  const cryptoCount = rules.filter(
    r => r.sourceKind === 'crypto' || r.sourceKind === 'any'
  ).length
  const bankCount = rules.filter(
    r => r.sourceKind === 'bank' || r.sourceKind === 'any'
  ).length

  const filteredRules =
    sourceFilter === 'all'
      ? rules
      : rules.filter(
          r => r.sourceKind === sourceFilter || r.sourceKind === 'any'
        )

  const handleSourceFilterClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const kind = event.currentTarget.dataset.kind as
        | SourceKindFilter
        | undefined
      if (kind) setSourceFilter(kind)
    },
    []
  )

  if (loading) {
    return (
      <div className="p-6 min-h-screen ledger-background flex items-center justify-center">
        <div className="text-[#294050] dark:text-[#9FB4BE]">
          Loading classification rules...
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 min-h-screen ledger-background">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="eyebrow">Accounting</p>
          <h1>Classification Rules</h1>
          <p className="text-[#294050] dark:text-[#9FB4BE] mt-1">
            Rules that auto-classify imported transactions into journal entries.
            Higher-priority rules (top) are evaluated first.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {rules.length === 0 && (
            <button
              onClick={handleInstallStarterPack}
              disabled={installingPack}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#5FE3C0]/10 text-[#294050] dark:text-[#5FE3C0] hover:bg-[#5FE3C0]/20 disabled:opacity-50 transition-colors"
            >
              <Package className="w-4 h-4" />
              {installingPack ? 'Installing...' : 'Install Starter Pack'}
            </button>
          )}
          <button
            onClick={handleNewRule}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#294050] text-white hover:bg-[#1E2F3C] transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Rule
          </button>
        </div>
      </div>

      {/* Error banner */}
      {(error ?? actionError) !== null && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error ?? actionError}
        </div>
      )}

      {/* Source filter tabs */}
      <div className="mb-4 flex items-center gap-4">
        <div className="flex rounded-lg border border-[rgba(95,227,192,0.15)] overflow-hidden">
          {[
            { kind: 'all' as const, label: 'All', count: rules.length },
            { kind: 'crypto' as const, label: 'Crypto', count: cryptoCount },
            { kind: 'bank' as const, label: 'Bank', count: bankCount },
          ].map(tab => (
            <button
              key={tab.kind}
              data-kind={tab.kind}
              onClick={handleSourceFilterClick}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                sourceFilter === tab.kind
                  ? 'bg-[#294050] text-white'
                  : 'text-[#294050] dark:text-[#9FB4BE] hover:bg-[#EAF3F2] dark:hover:bg-[#16242F]'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
        <span className="text-sm text-[#294050] dark:text-[#9FB4BE]">
          {enabledCount} enabled, {builtinCount} built-in
        </span>
      </div>

      {/* New rule form */}
      {showNewForm && (
        <div className="mb-6 bg-[#F7FAFA] dark:bg-[#0C141B] rounded-lg border border-[#5FE3C0]/30 p-4">
          <h3 className="text-sm font-semibold text-[#11202B] dark:text-[#EAF3F2] mb-3">
            New Classification Rule
          </h3>
          <RuleForm
            data={formData}
            onChange={setFormData}
            onSave={handleSave}
            onCancel={handleCancelEdit}
            saving={saving}
          />
        </div>
      )}

      {/* Rules list */}
      {filteredRules.length > 0 ? (
        <div className="space-y-2">
          {filteredRules.map((rule, index) => (
            <div
              key={rule.id}
              data-index={index}
              draggable
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              className={`bg-[#F7FAFA] dark:bg-[#0C141B] rounded-lg border transition-all ${
                dragIndex === index
                  ? 'border-[#5FE3C0] shadow-lg opacity-80'
                  : 'border-[rgba(95,227,192,0.15)]'
              } ${!rule.enabled ? 'opacity-60' : ''}`}
            >
              {editingId === rule.id ? (
                <div className="p-4">
                  <RuleForm
                    data={formData}
                    onChange={setFormData}
                    onSave={handleSave}
                    onCancel={handleCancelEdit}
                    saving={saving}
                  />
                </div>
              ) : (
                <RuleDisplayRow
                  rule={rule}
                  index={index}
                  rulesCount={filteredRules.length}
                  onToggle={handleToggle}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onMoveUp={handleMoveUp}
                  onMoveDown={handleMoveDown}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-[#F7FAFA] dark:bg-[#0C141B] rounded-lg border border-[rgba(95,227,192,0.15)]">
          <Shield className="mx-auto h-12 w-12 text-[#5FE3C0]" />
          <h3 className="mt-3 text-lg font-medium text-[#11202B] dark:text-[#EAF3F2]">
            No classification rules
          </h3>
          <p className="mt-1 text-sm text-[#294050] dark:text-[#9FB4BE] max-w-sm mx-auto">
            Install the starter rule pack to auto-classify 60–80% of common
            blockchain transactions on Day 1.
          </p>
          <button
            onClick={handleInstallStarterPack}
            disabled={installingPack}
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#294050] text-white hover:bg-[#1E2F3C] disabled:opacity-50 transition-colors text-sm font-medium"
          >
            <Package className="w-4 h-4" />
            {installingPack ? 'Installing...' : 'Install Starter Pack'}
          </button>
        </div>
      )}
    </div>
  )
}

export default ClassificationRules
