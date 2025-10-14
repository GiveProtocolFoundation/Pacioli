import React, { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  Search,
  Filter,
  Download,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  Eye,
  Receipt
} from 'lucide-react';

type TransactionType = 'all' | 'revenue' | 'expense' | 'transfers';

interface Transaction {
  id: string;
  date: string;
  description: string;
  type: 'revenue' | 'expense' | 'transfer';
  category: string;
  wallet: string;
  amount: number;
  crypto: string;
  usdValue: number;
  hash: string;
  status: 'completed' | 'pending' | 'failed';
  accountCode?: string; // Chart of Accounts code
  accountName?: string; // Chart of Accounts name
  memo?: string; // Additional notes (character limited)
}

const Transactions: React.FC = () => {
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');

  // Derive filter from URL instead of state
  const params = new URLSearchParams(location.search);
  const urlFilter = params.get('filter') as TransactionType;
  const filter: TransactionType =
    urlFilter && ['all', 'revenue', 'expense', 'transfers'].includes(urlFilter)
      ? urlFilter
      : 'all';

  // Dummy transaction data
  const allTransactions: Transaction[] = [
    {
      id: '1',
      date: '2025-01-12 14:32',
      description: 'Donation from John Doe',
      type: 'revenue',
      category: 'Donation',
      wallet: 'Main Wallet',
      amount: 2.5,
      crypto: 'ETH',
      usdValue: 6250.00,
      hash: '0x1234...5678',
      status: 'completed'
    },
    {
      id: '2',
      date: '2025-01-11 09:15',
      description: 'Marketing expenses',
      type: 'expense',
      category: 'Marketing',
      wallet: 'Operating Wallet',
      amount: 0.5,
      crypto: 'ETH',
      usdValue: 1250.00,
      hash: '0x2345...6789',
      status: 'completed'
    },
    {
      id: '3',
      date: '2025-01-10 16:45',
      description: 'Grant payment received',
      type: 'revenue',
      category: 'Grant',
      wallet: 'Main Wallet',
      amount: 10.0,
      crypto: 'ETH',
      usdValue: 25000.00,
      hash: '0x3456...7890',
      status: 'completed'
    },
    {
      id: '4',
      date: '2025-01-09 11:20',
      description: 'Transfer to Cold Storage',
      type: 'transfer',
      category: 'Internal Transfer',
      wallet: 'Main → Cold Storage',
      amount: 5.0,
      crypto: 'ETH',
      usdValue: 12500.00,
      hash: '0x4567...8901',
      status: 'completed'
    },
    {
      id: '5',
      date: '2025-01-08 13:30',
      description: 'Software subscription',
      type: 'expense',
      category: 'Operations',
      wallet: 'Operating Wallet',
      amount: 0.2,
      crypto: 'ETH',
      usdValue: 500.00,
      hash: '0x5678...9012',
      status: 'completed'
    },
    {
      id: '6',
      date: '2025-01-07 10:10',
      description: 'Monthly donation - Jane Smith',
      type: 'revenue',
      category: 'Donation',
      wallet: 'Main Wallet',
      amount: 1.0,
      crypto: 'ETH',
      usdValue: 2500.00,
      hash: '0x6789...0123',
      status: 'pending'
    },
    {
      id: '7',
      date: '2025-01-06 15:55',
      description: 'Event hosting costs',
      type: 'expense',
      category: 'Events',
      wallet: 'Operating Wallet',
      amount: 1.5,
      crypto: 'ETH',
      usdValue: 3750.00,
      hash: '0x7890...1234',
      status: 'completed'
    },
    {
      id: '8',
      date: '2025-01-05 12:40',
      description: 'Transfer from Hot to Warm Wallet',
      type: 'transfer',
      category: 'Internal Transfer',
      wallet: 'Hot → Warm Wallet',
      amount: 3.0,
      crypto: 'ETH',
      usdValue: 7500.00,
      hash: '0x8901...2345',
      status: 'completed'
    }
  ];

  // Filter transactions based on selected filter
  const filteredTransactions = allTransactions.filter(tx => {
    if (filter === 'all') return true;
    if (filter === 'transfers') return tx.type === 'transfer';
    return tx.type === filter;
  }).filter(tx => {
    if (!searchQuery) return true;
    return tx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
           tx.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
           tx.hash.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'revenue':
        return <ArrowDownRight className="w-5 h-5 text-green-600" />;
      case 'expense':
        return <ArrowUpRight className="w-5 h-5 text-red-600" />;
      case 'transfer':
        return <ArrowLeftRight className="w-5 h-5 text-blue-600" />;
      default:
        return null;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'revenue':
        return 'text-green-600 bg-green-50';
      case 'expense':
        return 'text-red-600 bg-red-50';
      case 'transfer':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-700 bg-green-100';
      case 'pending':
        return 'text-yellow-700 bg-yellow-100';
      case 'failed':
        return 'text-red-700 bg-red-100';
      default:
        return 'text-gray-700 bg-gray-100';
    }
  };

  return (
    <div className="p-6 min-h-screen bg-gray-50 dark:bg-black">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transactions</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          View and manage all your crypto transactions
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {[
            { key: 'all', label: 'All Transactions', count: allTransactions.length },
            { key: 'revenue', label: 'Revenue', count: allTransactions.filter(t => t.type === 'revenue').length },
            { key: 'expense', label: 'Expense', count: allTransactions.filter(t => t.type === 'expense').length },
            { key: 'transfers', label: 'Transfers', count: allTransactions.filter(t => t.type === 'transfer').length }
          ].map(tab => (
            <Link
              key={tab.key}
              to={`/transactions?filter=${tab.key}`}
              className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                filter === tab.key
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {tab.label}
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                filter === tab.key ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              }`}>
                {tab.count}
              </span>
            </Link>
          ))}
        </nav>
      </div>

      {/* Search and Actions Bar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
            <Calendar className="w-5 h-5" />
            <span className="hidden sm:inline">Date Range</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
            <Filter className="w-5 h-5" />
            <span className="hidden sm:inline">Filters</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Download className="w-5 h-5" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Wallet
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredTransactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${getTypeColor(transaction.type)}`}>
                      {getTypeIcon(transaction.type)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">{transaction.date}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{transaction.description}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{transaction.hash}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900 dark:text-white">{transaction.category}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-600 dark:text-gray-400">{transaction.wallet}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm font-semibold ${
                      transaction.type === 'revenue' ? 'text-green-600' :
                      transaction.type === 'expense' ? 'text-red-600' :
                      'text-blue-600'
                    }`}>
                      {transaction.type === 'revenue' ? '+' : transaction.type === 'expense' ? '-' : ''}
                      {transaction.amount} {transaction.crypto}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      ${transaction.usdValue.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(transaction.status)}`}>
                      {transaction.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button className="text-blue-600 hover:text-blue-900">
                      <Eye className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {filteredTransactions.length === 0 && (
          <div className="text-center py-12">
            <Receipt className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No transactions found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {searchQuery ? 'Try adjusting your search' : 'No transactions match the selected filter'}
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {filteredTransactions.length > 0 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Showing <span className="font-medium">1</span> to <span className="font-medium">{filteredTransactions.length}</span> of{' '}
            <span className="font-medium">{filteredTransactions.length}</span> results
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300">
              Previous
            </button>
            <button className="px-3 py-1 border rounded text-sm bg-blue-50 text-blue-600 border-blue-600 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-400">
              1
            </button>
            <button className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;
