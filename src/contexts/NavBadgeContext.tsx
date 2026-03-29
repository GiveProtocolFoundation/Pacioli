import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface NavBadgeCounts {
  unclassifiedTransactions: number
  draftJournalEntries: number
}

interface NavBadgeContextValue extends NavBadgeCounts {
  refreshCounts: () => void
}

const noop = () => {} // skipcq: JS-0321 — intentional no-op default for createContext

const NavBadgeContext = createContext<NavBadgeContextValue>({
  unclassifiedTransactions: 0,
  draftJournalEntries: 0,
  refreshCounts: noop,
})

// eslint-disable-next-line react-refresh/only-export-components
export const useNavBadges = () => useContext(NavBadgeContext)

/** Provider that fetches and exposes unclassified transaction and draft journal entry counts for nav badges. */
export const NavBadgeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [counts, setCounts] = useState<NavBadgeCounts>({
    unclassifiedTransactions: 0,
    draftJournalEntries: 0,
  })
  const mountedRef = useRef(true)

  const refreshCounts = useCallback(() => {
    Promise.all([
      invoke<number>('get_unclassified_transaction_count'),
      invoke<number>('get_draft_journal_entry_count'),
    ])
      .then(([unclassified, drafts]) => {
        if (mountedRef.current) {
          setCounts({
            unclassifiedTransactions: unclassified,
            draftJournalEntries: drafts,
          })
        }
      })
      .catch(err => {
        console.error('Failed to fetch nav badge counts:', err)
      })
  }, [])

  useEffect(() => {
    mountedRef.current = true
    refreshCounts()
    return () => {
      mountedRef.current = false
    }
  }, [refreshCounts])

  return (
    <NavBadgeContext.Provider value={{ ...counts, refreshCounts }}>
      {children}
    </NavBadgeContext.Provider>
  )
}
