import React from 'react'
import {
  formatMinorAsDollars,
  computeChangePercent,
  formatChangePercent,
} from './statementUtils'

interface StatementSectionHeadProps {
  showPrior: boolean
}

/** Shared table header for statement section tables (Account / Current / Prior / Change). */
export const StatementSectionHead: React.FC<StatementSectionHeadProps> = ({
  showPrior,
}) => (
  <thead>
    <tr className="border-b border-[rgba(95,227,192,0.2)]">
      <th className="px-4 py-2 text-left text-xs font-medium text-[#647D8B] uppercase">
        Account
      </th>
      <th className="px-4 py-2 text-right text-xs font-medium text-[#647D8B] uppercase">
        Current
      </th>
      {showPrior && (
        <th className="px-4 py-2 text-right text-xs font-medium text-[#647D8B] uppercase">
          Prior
        </th>
      )}
      {showPrior && (
        <th className="px-4 py-2 text-right text-xs font-medium text-[#647D8B] uppercase">
          Change
        </th>
      )}
    </tr>
  </thead>
)

interface StatementSectionFootProps {
  label: string
  totalMinor: number
  priorTotalMinor: number | null
}

/** Shared table footer with the section total and optional prior comparison. */
export const StatementSectionFoot: React.FC<StatementSectionFootProps> = ({
  label,
  totalMinor,
  priorTotalMinor,
}) => (
  <tfoot>
    <tr className="border-t-2 border-[#5FE3C0] font-bold">
      <td className="px-4 py-2 text-sm text-[#11202B] dark:text-[#EAF3F2]">
        {label}
      </td>
      <td className="px-4 py-2 text-sm text-right font-mono text-[#11202B] dark:text-[#EAF3F2]">
        {formatMinorAsDollars(totalMinor)}
      </td>
      {priorTotalMinor !== null && (
        <td className="px-4 py-2 text-sm text-right font-mono text-[#647D8B]">
          {formatMinorAsDollars(priorTotalMinor)}
        </td>
      )}
      {priorTotalMinor !== null && (
        <td className="px-4 py-2 text-sm text-right font-mono text-[#647D8B]">
          {formatChangePercent(
            computeChangePercent(totalMinor, priorTotalMinor)
          )}
        </td>
      )}
    </tr>
  </tfoot>
)
