import React from 'react'
import { Scale, Construction } from 'lucide-react'

/** Placeholder Reconciliation page */
const Reconciliation: React.FC = () => (
  <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
    {/* Header */}
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-[#1a1815] dark:text-[#f5f3f0]">
        Reconciliation
      </h1>
      <p className="text-sm text-[#696557] dark:text-[#b8b3ac] mt-1">
        Verify your ledger balances match on-chain data
      </p>
    </div>

    {/* Coming soon card */}
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="relative mb-6">
        <Scale className="w-16 h-16 text-[#a39d94]" />
        <Construction className="w-6 h-6 text-[#c9a961] absolute -bottom-1 -right-1" />
      </div>
      <h3 className="text-lg font-medium text-[#1a1815] dark:text-[#f5f3f0]">
        Coming soon
      </h3>
      <p className="text-sm text-[#696557] dark:text-[#b8b3ac] mt-2 max-w-md">
        Reconciliation will allow you to compare your posted ledger balances
        against live on-chain data, flag discrepancies, and mark accounts as
        reconciled.
      </p>
      <span className="mt-4 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[#c9a961]/10 text-[#c9a961] border border-[#c9a961]/20">
        Planned for a future release
      </span>
    </div>
  </div>
)

export default Reconciliation
