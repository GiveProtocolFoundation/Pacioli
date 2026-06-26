import React from 'react'
import { Scale, Construction } from 'lucide-react'

/** Placeholder Reconciliation page */
const Reconciliation: React.FC = () => (
  <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
    {/* Header */}
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-[#11202B] dark:text-[#EAF3F2]">
        Reconciliation
      </h1>
      <p className="text-sm text-[#294050] dark:text-[#9FB4BE] mt-1">
        Verify your ledger balances match on-chain data
      </p>
    </div>

    {/* Coming soon card */}
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="relative mb-6">
        <Scale className="w-16 h-16 text-[#647D8B]" />
        <Construction className="w-6 h-6 text-[#5FE3C0] absolute -bottom-1 -right-1" />
      </div>
      <h3 className="text-lg font-medium text-[#11202B] dark:text-[#EAF3F2]">
        Coming soon
      </h3>
      <p className="text-sm text-[#294050] dark:text-[#9FB4BE] mt-2 max-w-md">
        Reconciliation will allow you to compare your posted ledger balances
        against live on-chain data, flag discrepancies, and mark accounts as
        reconciled.
      </p>
      <span className="mt-4 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[#5FE3C0]/10 text-[#5FE3C0] border border-[#5FE3C0]/20">
        Planned for a future release
      </span>
    </div>
  </div>
)

export default Reconciliation
