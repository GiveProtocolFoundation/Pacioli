import React from 'react'
import { Monitor, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const DOWNLOAD_URL = 'https://pacioli.io'

/** @returns Full-page amber banner directing users to the desktop app for accounting features. */
const DesktopRequiredBanner: React.FC = () => {
  const navigate = useNavigate()

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-6">
          <Monitor className="w-8 h-8 text-amber-600 dark:text-amber-400" />
        </div>

        <h1 className="text-xl font-semibold text-[#11202B] dark:text-[#EAF3F2] mb-2">
          Desktop App Required
        </h1>

        <p className="text-[#294050] dark:text-[#9FB4BE] mb-6">
          Accounting features — Chart of Accounts, journal entries, financial
          reports, and classification — require the Pacioli desktop app. The web
          build is view-only for wallets and portfolio.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href={DOWNLOAD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#294050] dark:bg-[#5FE3C0] text-white dark:text-[#0C141B] rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Get the Desktop App
            <ArrowRight className="w-4 h-4" />
          </a>
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center justify-center px-5 py-2.5 border border-[#294050]/20 dark:border-[#9FB4BE]/20 text-[#294050] dark:text-[#9FB4BE] rounded-lg font-medium hover:bg-[#294050]/5 dark:hover:bg-[#9FB4BE]/5 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}

export default DesktopRequiredBanner
