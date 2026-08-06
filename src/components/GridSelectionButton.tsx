import React from 'react'
import { LucideIcon } from 'lucide-react'

interface GridSelectionButtonProps {
  icon: LucideIcon
  title: string
  description: string
  subtitle?: string
  isSelected: boolean
  onClick: () => void
  value: string
  gridLayout?: boolean
  /** When true, suppress dark-mode variants (for light-only contexts like onboarding). */
  forceLight?: boolean
}

/**
 * A button component for selecting an item in a grid, displaying an icon, title, description, and optional subtitle.
 * @param icon - The icon component to display.
 * @param title - The main title text.
 * @param description - The descriptive text.
 * @param subtitle - Optional subtitle text displayed below the title.
 * @param isSelected - Flag indicating if the button is selected.
 * @param onClick - Callback invoked when the button is clicked.
 * @param forceLight - Suppress dark-mode variants for light-only host pages.
 * @returns The rendered GridSelectionButton component.
 */
export const GridSelectionButton: React.FC<GridSelectionButtonProps> = ({
  icon: Icon,
  title,
  description,
  subtitle,
  isSelected,
  onClick,
  forceLight = false,
}) => {
  const containerClass = isSelected
    ? forceLight
      ? 'border-[#294050] bg-[#294050]/10'
      : 'border-[#294050] bg-[#294050]/10 dark:bg-[#294050]/20'
    : forceLight
      ? 'border-gray-200 hover:border-gray-300 bg-white'
      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'

  const iconBgClass = isSelected
    ? forceLight
      ? 'bg-[#294050]/20'
      : 'bg-[#294050]/20 dark:bg-[#294050]/30'
    : forceLight
      ? 'bg-gray-100'
      : 'bg-gray-100 dark:bg-gray-700'

  const iconColorClass = isSelected
    ? forceLight
      ? 'text-[#294050]'
      : 'text-[#294050] dark:text-[#F09988]'
    : forceLight
      ? 'text-gray-600'
      : 'text-gray-600 dark:text-gray-400'

  const titleClass = isSelected
    ? forceLight
      ? 'text-[#294050]'
      : 'text-[#294050] dark:text-[#9CF1DC]'
    : forceLight
      ? 'text-gray-900'
      : 'text-gray-900 dark:text-white'

  const descClass = forceLight
    ? 'text-sm text-gray-600 mt-1'
    : 'text-sm text-gray-600 dark:text-gray-400 mt-1'

  const subClass = forceLight
    ? 'text-xs text-gray-500 mt-2'
    : 'text-xs text-gray-500 dark:text-gray-500 mt-2'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full p-6 rounded-xl border-2 text-left transition-all duration-200 ${containerClass}`}
    >
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-lg ${iconBgClass}`}>
          <Icon className={`w-6 h-6 ${iconColorClass}`} />
        </div>
        <div className="flex-1">
          <h3 className={`font-semibold ${titleClass}`}>{title}</h3>
          <p className={descClass}>{description}</p>
          {subtitle && <p className={subClass}>{subtitle}</p>}
        </div>
        {isSelected && (
          <div className="flex-shrink-0">
            <div className="w-6 h-6 rounded-full bg-[#294050] flex items-center justify-center">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>
        )}
      </div>
    </button>
  )
}
