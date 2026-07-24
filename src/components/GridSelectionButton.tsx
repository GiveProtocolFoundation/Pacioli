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
}

/**
 * Renders a grid selection button with an icon, title, description, and optional subtitle, reflecting its selected state.
 *
 * @param icon The icon component to display in the button.
 * @param title The title text displayed prominently.
 * @param description The descriptive text shown below the title.
 * @param subtitle Optional subtitle text shown below the description.
 * @param isSelected Whether the button is currently selected.
 * @param onClick Callback function invoked when the button is clicked.
 * @returns The rendered grid selection button component.
 */
export const GridSelectionButton: React.FC<GridSelectionButtonProps> = ({
  icon: Icon,
  title,
  description,
  subtitle,
  isSelected,
  onClick,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full p-6 rounded-xl border-2 text-left transition-all duration-200 ${
        isSelected
          ? 'border-[#294050] bg-[#294050]/10 dark:bg-[#294050]/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`p-3 rounded-lg ${
            isSelected
              ? 'bg-[#294050]/20 dark:bg-[#294050]/30'
              : 'bg-gray-100 dark:bg-gray-700'
          }`}
          <Icon
            className={`w-6 h-6 ${
              isSelected
                ? 'text-[#294050] dark:text-[#F09988]'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          />
        </div>
        <div className="flex-1">
          <h3
            className={`font-semibold ${
              isSelected
                ? 'text-[#294050] dark:text-[#9CF1DC]'
                : 'text-gray-900 dark:text-white'
            }`}
          >
            {title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {description}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
              {subtitle}
            </p>
          )}
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
