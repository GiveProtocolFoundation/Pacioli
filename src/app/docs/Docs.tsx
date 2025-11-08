import React, { useState, useCallback } from 'react'
import {
  BookOpen,
  Rocket,
  Lightbulb,
  BookMarked,
  Link2,
  Building2,
  Wrench,
  Lock,
  FileText,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

interface DocSection {
  id: string
  title: string
  icon: React.ComponentType<{ className?: string }>
  items: DocItem[]
}

interface DocItem {
  id: string
  title: string
  items?: DocSubItem[]
}

interface DocSubItem {
  id: string
  title: string
}

const documentationStructure: DocSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: Rocket,
    items: [
      { id: 'what-is-pacioli', title: 'What is Pacioli?' },
      { id: 'installation', title: 'Installation Guide' },
      { id: 'first-time-setup', title: 'First-Time Setup' },
      { id: 'connecting-wallets', title: 'Connecting Your Wallets' },
      { id: 'quick-start', title: 'Quick Start Tutorial (15 min)' },
      { id: 'video-walkthrough', title: 'Video Walkthrough' },
    ],
  },
  {
    id: 'core-concepts',
    title: 'Core Concepts',
    icon: Lightbulb,
    items: [
      { id: 'double-entry', title: 'Understanding Double-Entry Accounting' },
      { id: 'how-it-works', title: 'How Pacioli Works' },
      { id: 'chart-of-accounts', title: 'Chart of Accounts Explained' },
      { id: 'cost-basis', title: 'Cost Basis Methods (FIFO, LIFO, etc.)' },
      { id: 'transaction-categories', title: 'Transaction Categories' },
      { id: 'triple-entry', title: 'The Road to Triple-Entry Accounting' },
    ],
  },
  {
    id: 'user-guides',
    title: 'User Guides',
    icon: BookMarked,
    items: [
      { id: 'dashboard-overview', title: 'Dashboard Overview' },
      { id: 'managing-transactions', title: 'Managing Transactions' },
      { id: 'running-reports', title: 'Running Reports' },
      { id: 'tax-preparation', title: 'Tax Preparation' },
      { id: 'multi-wallet', title: 'Multi-Wallet Management' },
      { id: 'defi-tracking', title: 'DeFi Activity Tracking' },
      { id: 'give-protocol', title: 'Give Protocol Integration' },
    ],
  },
  {
    id: 'blockchain-support',
    title: 'Blockchain Support',
    icon: Link2,
    items: [
      { id: 'ethereum', title: 'Ethereum' },
      { id: 'arbitrum', title: 'Arbitrum' },
      { id: 'matic', title: 'Matic' },
      { id: 'polkadot', title: 'Polkadot Relay Chain' },
      { id: 'kusama', title: 'Kusama Network' },
      {
        id: 'parachains',
        title: 'Parachain Guides',
        items: [
          { id: 'moonbeam', title: 'Moonbeam/Moonriver' },
          { id: 'astar', title: 'Astar/Shiden' },
          { id: 'acala', title: 'Acala/Karura' },
          { id: 'parallel', title: 'Parallel Finance' },
          { id: 'other-parachains', title: 'Other Parachains' },
        ],
      },
      { id: 'staking', title: 'Staking & Nomination Pools' },
      { id: 'xcm', title: 'XCM Cross-Chain Transactions' },
      { id: 'crowdloans', title: 'Crowdloans & Parachain Auctions' },
    ],
  },
  {
    id: 'business',
    title: 'Business Use Cases',
    icon: Building2,
    items: [
      { id: 'business-accounting', title: 'Business' },
      { id: 'non-profit', title: 'Non-Profit Organizations' },
      { id: 'daos', title: 'DAOs & Treasuries' },
      { id: 'multi-entity', title: 'Multi-Entity Accounting' },
      { id: 'bookkeepers', title: 'Professional Bookkeepers' },
    ],
  },
  {
    id: 'advanced',
    title: 'Advanced Features',
    icon: Wrench,
    items: [
      { id: 'custom-reports', title: 'Custom Reports' },
      { id: 'api-integration', title: 'API Integration' },
      { id: 'plugin-dev', title: 'Plugin Development' },
      { id: 'import-export', title: 'Data Import/Export' },
      { id: 'automation', title: 'Automation Rules' },
      { id: 'reconciliation', title: 'Advanced Reconciliation' },
    ],
  },
  {
    id: 'security',
    title: 'Security & Privacy',
    icon: Lock,
    items: [
      { id: 'encryption', title: 'Data Encryption' },
      { id: 'wallet-security', title: 'Wallet Connection Security' },
      { id: 'backup', title: 'Backup & Recovery' },
      { id: 'best-practices', title: 'Best Practices' },
      { id: 'privacy-policy', title: 'Privacy Policy' },
    ],
  },
  {
    id: 'compliance',
    title: 'Compliance & Regulations',
    icon: FileText,
    items: [
      { id: 'us-tax', title: 'US Tax Compliance (IRS)' },
      { id: 'intl-tax', title: 'International Tax Guidelines' },
      { id: 'gaap-ifrs', title: 'GAAP & IFRS Standards' },
      { id: 'audit-prep', title: 'Audit Preparation' },
      { id: 'country-guides', title: 'Country-Specific Guides' },
    ],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    icon: AlertCircle,
    items: [
      { id: 'common-issues', title: 'Common Issues & Solutions' },
      { id: 'error-messages', title: 'Error Messages Explained' },
      { id: 'performance', title: 'Performance Optimization' },
      { id: 'data-recovery', title: 'Data Recovery' },
      { id: 'contact-support', title: 'Contact Support' },
    ],
  },
]

const Docs: React.FC = () => {
  const [expandedSections, setExpandedSections] = useState<string[]>([
    'getting-started',
  ])
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const [selectedDoc, setSelectedDoc] = useState<string>('what-is-pacioli')

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    )
  }

  const toggleItem = (itemId: string) => {
    setExpandedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    )
  }

  const handleSelectDoc = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const docId = e.currentTarget.getAttribute('data-doc-id')
    if (docId) {
      setSelectedDoc(docId)
    }
  }, [])

  return (
    <div className="min-h-screen ledger-background">
      {/* Header */}
      <header className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-10 py-10">
          <div className="flex items-center">
            <BookOpen className="w-8 h-8 text-[#7c3626] dark:text-[#a04830] mr-4" />
            <div>
              <h1>Pacioli Documentation</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Comprehensive guides and references for using Pacioli accounting
                software
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-10 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <aside className="lg:col-span-1">
            <div className="ledger-card ledger-card-financial border border-gray-200 dark:border-gray-700 p-6 sticky top-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Contents
              </h2>
              <nav className="space-y-2">
                {documentationStructure.map(section => {
                  const isExpanded = expandedSections.includes(section.id)
                  const Icon = section.icon

                  return (
                    <div key={section.id}>
                      <button
                        onClick={() => toggleSection(section.id)}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
                      >
                        <div className="flex items-center">
                          <Icon className="w-4 h-4 mr-2 text-[#7c3626] dark:text-[#a04830]" />
                          <span className="font-medium text-gray-900 dark:text-white">
                            {section.title}
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="ml-6 mt-1 space-y-1">
                          {section.items.map(item => {
                            const hasSubItems = item.items && item.items.length > 0
                            const isItemExpanded = expandedItems.includes(item.id)
                            const isSelected = selectedDoc === item.id

                            return (
                              <div key={item.id}>
                                <button
                                  onClick={() => {
                                    if (hasSubItems) {
                                      toggleItem(item.id)
                                    } else {
                                      setSelectedDoc(item.id)
                                    }
                                  }}
                                  className={`w-full flex items-center justify-between px-3 py-1.5 text-sm rounded transition-colors text-left ${
                                    isSelected
                                      ? 'bg-[#7c3626]/10 dark:bg-[#a04830]/10 text-[#7c3626] dark:text-[#a04830] font-medium'
                                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                                  }`}
                                >
                                  <span>{item.title}</span>
                                  {hasSubItems &&
                                    (isItemExpanded ? (
                                      <ChevronDown className="w-3 h-3" />
                                    ) : (
                                      <ChevronRight className="w-3 h-3" />
                                    ))}
                                </button>

                                {hasSubItems && isItemExpanded && (
                                  <div className="ml-4 mt-1 space-y-1">
                                    {item.items!.map(subItem => {
                                      const isSubSelected = selectedDoc === subItem.id

                                      return (
                                        <button
                                          key={subItem.id}
                                          data-doc-id={subItem.id}
                                          onClick={handleSelectDoc}
                                          className={`w-full px-3 py-1 text-xs rounded transition-colors text-left ${
                                            isSubSelected
                                              ? 'bg-[#7c3626]/10 dark:bg-[#a04830]/10 text-[#7c3626] dark:text-[#a04830] font-medium'
                                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                                          }`}
                                        >
                                          {subItem.title}
                                        </button>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </nav>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="lg:col-span-3">
            <div className="ledger-card ledger-card-wallet border border-gray-200 dark:border-gray-700 p-8">
              {/* Placeholder Content */}
              <div className="prose dark:prose-invert max-w-none">
                <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="inline-block px-3 py-1 bg-[#8b7355]/10 dark:bg-[#a38a6f]/10 rounded text-xs font-medium text-[#8b7355] dark:text-[#a38a6f] mb-4">
                    Coming Soon
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {selectedDoc
                      .split('-')
                      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                      .join(' ')}
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400">
                    This documentation page is currently being prepared and will be
                    available soon.
                  </p>
                </div>

                {/* Placeholder Content Blocks */}
                <div className="space-y-6">
                  <div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6 mb-2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/5"></div>
                  </div>

                  <div className="bg-[#7c3626]/5 dark:bg-[#a04830]/5 border-l-4 border-[#7c3626] dark:border-[#a04830] p-4 rounded">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <strong className="text-[#7c3626] dark:text-[#a04830]">
                        Note:
                      </strong>{' '}
                      Documentation content will be added here covering detailed
                      information about this topic.
                    </p>
                  </div>

                  <div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-3"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-11/12 mb-2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
                    <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
                      <span className="text-gray-400 dark:text-gray-500 text-sm">
                        Diagram or Screenshot Placeholder
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-3"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/5"></div>
                  </div>
                </div>

                {/* Footer Navigation */}
                <div className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <button className="btn-secondary text-sm">
                    <ChevronRight className="w-4 h-4 rotate-180" />
                    Previous
                  </button>
                  <button className="btn-primary text-sm">
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default Docs
