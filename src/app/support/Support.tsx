import React, { useState, useCallback } from 'react'
import {
  BookOpen,
  Search,
  Mail,
  MessageCircle,
  FileText,
  Video,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  Book,
  Code,
  Coins,
  Zap,
  Github,
} from 'lucide-react'

interface HelpTopic {
  id: string
  title: string
  description: string
  icon: React.ElementType
  url: string
  category: 'guide' | 'crypto' | 'api' | 'tutorial'
}

interface QuickLink {
  title: string
  url: string
  icon: React.ElementType
}

const helpTopics: HelpTopic[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Set up your organization and start using Pacioli',
    icon: BookOpen,
    url: '/docs/getting-started/',
    category: 'guide',
  },
  {
    id: 'transactions',
    title: 'Recording Transactions',
    description: 'Learn how to record and manage transactions',
    icon: FileText,
    url: '/docs/user-guide/transactions/',
    category: 'guide',
  },
  {
    id: 'crypto-wallets',
    title: 'Connecting Wallets',
    description: 'Connect and manage your cryptocurrency wallets',
    icon: Coins,
    url: '/docs/crypto-operations/wallet-connection/',
    category: 'crypto',
  },
  {
    id: 'staking',
    title: 'Staking & Rewards',
    description: 'Track staking rewards and manage delegations',
    icon: Zap,
    url: '/docs/crypto-operations/staking-rewards/',
    category: 'crypto',
  },
  {
    id: 'reports',
    title: 'Financial Reports',
    description: 'Generate and customize financial reports',
    icon: FileText,
    url: '/docs/user-guide/reports/',
    category: 'guide',
  },
  {
    id: 'api',
    title: 'API Integration',
    description: 'Integrate Pacioli with your systems',
    icon: Code,
    url: '/docs/api-reference/',
    category: 'api',
  },
]

const quickLinks: QuickLink[] = [
  { title: 'User Guide', url: '/docs/user-guide/', icon: Book },
  { title: 'Crypto Operations', url: '/docs/crypto-operations/', icon: Coins },
  { title: 'API Reference', url: '/docs/api-reference/', icon: Code },
  { title: 'FAQ', url: '/docs/faq/', icon: HelpCircle },
]

const Support: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<
    'all' | 'guide' | 'crypto' | 'api' | 'tutorial'
  >('all')

  const filteredTopics = helpTopics.filter(topic => {
    const matchesSearch =
      topic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      topic.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory =
      selectedCategory === 'all' || topic.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value)
    },
    []
  )

  const handleCategoryAll = useCallback(() => setSelectedCategory('all'), [])
  const handleCategoryGuide = useCallback(
    () => setSelectedCategory('guide'),
    []
  )
  const handleCategoryCrypto = useCallback(
    () => setSelectedCategory('crypto'),
    []
  )
  const handleCategoryApi = useCallback(() => setSelectedCategory('api'), [])

  return (
    <div className="min-h-screen ledger-background">
      {/* Header */}
      <header className="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Support
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Documentation, guides, and help resources
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search */}
        <div className="mb-8">
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search documentation..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full pl-12 pr-4 py-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={handleCategoryAll}
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedCategory === 'all'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                All
              </button>
              <button
                onClick={handleCategoryGuide}
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedCategory === 'guide'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                User Guide
              </button>
              <button
                onClick={handleCategoryCrypto}
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedCategory === 'crypto'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                Crypto
              </button>
              <button
                onClick={handleCategoryApi}
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedCategory === 'api'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                API
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Links */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {quickLinks.map(link => {
                const Icon = link.icon
                return (
                  <a
                    key={link.title}
                    href={link.url}
                    className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-blue-400 dark:hover:border-blue-600 transition-colors flex flex-col items-center text-center"
                  >
                    <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-3">
                      <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {link.title}
                    </span>
                  </a>
                )
              })}
            </div>

            {/* Popular Topics */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Popular Topics
              </h2>
              <div className="space-y-3">
                {filteredTopics.map(topic => {
                  const Icon = topic.icon
                  return (
                    <a
                      key={topic.id}
                      href={topic.url}
                      className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-blue-400 dark:hover:border-blue-600 transition-colors flex items-start justify-between group"
                    >
                      <div className="flex items-start flex-1">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="ml-4 flex-1">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                            {topic.title}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {topic.description}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex-shrink-0 ml-4" />
                    </a>
                  )
                })}
              </div>
            </div>

            {/* Video Tutorials */}
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6 text-white">
              <div className="flex items-start">
                <Video className="w-8 h-8 flex-shrink-0" />
                <div className="ml-4 flex-1">
                  <h3 className="text-lg font-semibold mb-2">
                    Video Tutorials
                  </h3>
                  <p className="text-sm opacity-90 mb-4">
                    Watch step-by-step video guides to learn Pacioli features
                  </p>
                  <a
                    href="https://youtube.com/pacioli"
                    className="inline-flex items-center px-4 py-2 bg-white text-purple-600 rounded-lg hover:bg-purple-50 text-sm font-medium"
                  >
                    Watch Tutorials
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Support */}
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                Contact Support
              </h3>
              <div className="space-y-3">
                <a
                  href="mailto:support@pacioli.io"
                  className="flex items-center text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  <Mail className="w-4 h-4 mr-3" />
                  Email Support
                </a>
                <a
                  href="https://community.pacioli.io"
                  className="flex items-center text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  <MessageCircle className="w-4 h-4 mr-3" />
                  Community Forum
                </a>
                <a
                  href="https://github.com/civicmastery/Pacioli/issues"
                  className="flex items-center text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  <Github className="w-4 h-4 mr-3" />
                  Report Issue
                </a>
              </div>
            </div>

            {/* System Status */}
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                System Status
              </h3>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  API
                </span>
                <span className="flex items-center text-sm text-green-600 dark:text-green-400">
                  <span className="w-2 h-2 bg-green-600 rounded-full mr-2"></span>
                  Operational
                </span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Web App
                </span>
                <span className="flex items-center text-sm text-green-600 dark:text-green-400">
                  <span className="w-2 h-2 bg-green-600 rounded-full mr-2"></span>
                  Operational
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Blockchain Sync
                </span>
                <span className="flex items-center text-sm text-green-600 dark:text-green-400">
                  <span className="w-2 h-2 bg-green-600 rounded-full mr-2"></span>
                  Operational
                </span>
              </div>
              <a
                href="https://status.pacioli.io"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-3 inline-flex items-center"
              >
                View Status Page
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </div>

            {/* Latest Updates */}
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                Latest Updates
              </h3>
              <div className="space-y-3">
                <div className="pb-3 border-b border-gray-200 dark:border-gray-700 last:border-0 last:pb-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Version 1.2.0 Released
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    New analytics features and performance improvements
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Oct 15, 2025
                  </p>
                </div>
                <div className="pb-3 border-b border-gray-200 dark:border-gray-700 last:border-0 last:pb-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    New Staking Support
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Added support for GLMR and ASTR staking
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Oct 10, 2025
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    API v1 Launched
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Full REST API now available
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Oct 1, 2025
                  </p>
                </div>
              </div>
            </div>

            {/* Documentation Links */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Full Documentation
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                Access the complete Pacioli documentation site for in-depth
                guides and references.
              </p>
              <a
                href="/docs/"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium w-full justify-center"
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Open Documentation
                <ExternalLink className="w-4 h-4 ml-2" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Support
