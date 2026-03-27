import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface NavBadgeCounts {
  unclassifiedTransactions: number
  draftJournalEntries: number
}

interface NavBadgeContextValue extends NavBadgeCounts {
  refreshCounts: () => Promise<void>
}

const NavBadgeContext = createContext<NavBadgeContextValue>({
  unclassifiedTransactions: 0,
  draftJournalEntries: 0,
  refreshCounts: async () => {},
})

export const NavBadgeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [counts, setCounts] = useState<NavBadgeCounts>({
    unclassifiedTransactions: 0,
    draftJournalEntries: 0,
  })

  const refreshCounts = useCallback(async () => {
    try {
      const [unclassified, drafts] = await Promise.all([
        invoke<number>('get_unclassified_transaction_count'),
        invoke<number>('get_draft_journal_entry_count'),
      ])
      setCounts({
        unclassifiedTransactions: unclassified,
        draftJournalEntries: drafts,
      })
    } catch (err) {
      console.error('Failed to fetch nav badge counts:', err)
    }
  }, [])

  useEffect(() => {
    refreshCounts()
  }, [refreshCounts])

  return (
    <NavBadgeContext.Provider value={{ ...counts, refreshCounts }}>
      {children}
    </NavBadgeContext.Provider>
  )
}

export const useNavBadges = () => useContext(NavBadgeContext)
