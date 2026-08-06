import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'
import { Building2, User, Check } from 'lucide-react'
import PacioliBlackLogo from '../../assets/pacioli_logo_black.svg'
import { GridSelectionButton } from '../../components/GridSelectionButton'
import { persistence } from '../../services/persistence'
import { useAuth } from '../../contexts/AuthContext'
import { useProfile } from '../../contexts/ProfileContext'
import { COUNTRIES } from '../../constants/countries'
import { defaultFrameworkForCountry } from '../../utils/chartOfAccounts'

type Step = 'jurisdiction' | 'account-type' | 'complete'
type Jurisdiction = 'us-gaap' | 'ifrs'
type AccountType = 'individual' | 'for-profit-enterprise' | 'not-for-profit'

interface ProgressStepProps {
  label: string
  isActive: boolean
  isCompleted: boolean
  stepNumber: number
}

/**
 * Renders a step in the onboarding progress indicator.
 * @param label - The label for the step.
 * @param isActive - Whether the step is currently active.
 * @param isCompleted - Whether the step has been completed.
 * @param stepNumber - The step number to display.
 * @returns JSX.Element representing the progress step.
 */
const ProgressStep: React.FC<ProgressStepProps> = ({
  label,
  isActive,
  isCompleted,
  stepNumber,
}) => {
  /**
   * Determines the CSS class name based on step status.
   * @returns The CSS class string for the step.
   */
  const getStepClassName = () => {
    if (isActive) return 'bg-[#8b4e52] text-white'
    if (isCompleted) return 'bg-[#2E9A82] text-white'
    return 'bg-gray-200 text-gray-600'
  }

  return (
    <div className="flex items-center">
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center ${getStepClassName()}`}
      >
        {isCompleted ? <Check className="w-5 h-5" /> : stepNumber}
      </div>
      <span className="ml-2 text-sm font-medium text-gray-700">{label}</span>
    </div>
  )
}

interface ProgressConnectorProps {
  isCompleted: boolean
}

/**
 * Renders the connector between progress steps.
 * @param isCompleted - Whether the preceding step is completed.
 * @returns JSX.Element representing the progress connector.
 */
const ProgressConnector: React.FC<ProgressConnectorProps> = ({
  isCompleted,
}) => (
  <div className="w-16 h-1 bg-gray-300">
    <div
      className={`h-full transition-all ${isCompleted ? 'bg-[#8b4e52] w-full' : 'bg-transparent w-0'}`}
    />
  </div>
)

/**
 * Looks up the human-readable country name from the COUNTRIES list.
 * @param code - ISO alpha-2 country code.
 * @returns The country label, or the code itself if not found.
 */
function countryNameForCode(code: string): string {
  const entry = COUNTRIES.find(c => c.value === code)
  return entry?.label ?? code
}

/**
 * Main onboarding component to guide users through setup steps.
 * @returns JSX.Element representing the onboarding flow.
 */
const Onboarding: React.FC = () => {
  const navigate = useNavigate()
  const { completeOnboarding } = useAuth()
  const { currentProfile } = useProfile()
  const [currentStep, setCurrentStep] = useState<Step>('jurisdiction')
  const [country, setCountry] = useState<string>('')
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction | null>(null)
  const [accountType, setAccountType] = useState<AccountType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCountryChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const code = e.target.value
      setCountry(code)
      const framework = defaultFrameworkForCountry(code)
      if (framework) {
        setJurisdiction(framework)
      }
    },
    []
  )

  const handleFrameworkChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setJurisdiction(e.target.value as Jurisdiction)
    },
    []
  )

  const handleAccountTypeSelect = useCallback((selected: AccountType) => {
    setAccountType(selected)
  }, [])

  const handleContinue = useCallback(async () => {
    if (currentStep === 'jurisdiction' && jurisdiction && country) {
      setCurrentStep('account-type')
    } else if (currentStep === 'account-type' && accountType && jurisdiction) {
      setError(null)
      setIsSubmitting(true)
      try {
        await persistence.setSetting('country', country)
        await persistence.setSetting('accountType', accountType)
        await persistence.setSetting('jurisdiction', jurisdiction)

        const profileId = currentProfile?.id ?? 'default'
        await invoke('import_chart_of_accounts_template', {
          input: { jurisdiction, accountType, profileId },
        })

        completeOnboarding(accountType)
        navigate('/dashboard')
      } catch (err) {
        const message =
          typeof err === 'string' ? err : 'Failed to set up chart of accounts'
        setError(message)
        console.error('[Onboarding] Setup failed:', err)
      } finally {
        setIsSubmitting(false)
      }
    }
  }, [
    currentStep,
    jurisdiction,
    accountType,
    country,
    currentProfile,
    navigate,
    completeOnboarding,
  ])

  const handleBack = useCallback(() => {
    if (currentStep === 'account-type') {
      setCurrentStep('jurisdiction')
    }
  }, [currentStep])

  const handleSelectIndividual = useCallback(() => {
    handleAccountTypeSelect('individual')
  }, [handleAccountTypeSelect])

  const handleSelectSME = useCallback(() => {
    handleAccountTypeSelect('for-profit-enterprise')
  }, [handleAccountTypeSelect])

  const handleSelectNonProfit = useCallback(() => {
    handleAccountTypeSelect('not-for-profit')
  }, [handleAccountTypeSelect])

  const canContinue =
    !isSubmitting &&
    ((currentStep === 'jurisdiction' && jurisdiction && country) ||
      (currentStep === 'account-type' && accountType))

  const isJurisdictionStep = currentStep === 'jurisdiction'
  const isAccountTypeStep = currentStep === 'account-type'

  const usGaapLabel =
    country && country !== 'US'
      ? 'US GAAP — for entities reporting to US parents/investors'
      : 'US GAAP — Recommended for United States'

  const ifrsLabel =
    country && country !== 'US'
      ? `IFRS / Local Standard — Recommended for ${countryNameForCode(country)}`
      : 'IFRS / Local Standard'

  /**
   * Returns the class name for the back button based on the current step state.
   * @returns {string} CSS class name for the back button.
   */
  const getBackButtonClassName = () => {
    return isJurisdictionStep
      ? 'text-gray-400 cursor-not-allowed'
      : 'text-gray-700 hover:bg-gray-50'
  }

  /**
   * Returns the class name for the continue button based on whether the form can continue.
   * @returns {string} CSS class name for the continue button.
   */
  const getContinueButtonClassName = () => {
    return canContinue
      ? 'bg-[#8b4e52] text-white hover:bg-[#7a4248]'
      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
  }

  /**
   * Returns the text for the continue button based on submission and step state.
   * @returns {string} The text to display on the continue button.
   */
  const getContinueButtonText = () => {
    if (isSubmitting) return 'Setting up...'
    return isAccountTypeStep ? 'Complete Setup' : 'Continue'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fafaf8] to-[#ede8e0] flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <img
              src={PacioliBlackLogo}
              alt="Pacioli"
              className="h-12 w-auto mix-blend-multiply"
            />
            <span className="ml-3 text-2xl font-bold text-gray-900">
              Pacioli
            </span>
          </div>
          <p className="text-gray-600">Let&apos;s set up your account</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
            <ProgressStep
              label="Location"
              isActive={isJurisdictionStep}
              isCompleted={Boolean(jurisdiction) && Boolean(country)}
              stepNumber={1}
            />
            <ProgressConnector
              isCompleted={Boolean(jurisdiction) && Boolean(country)}
            />
            <ProgressStep
              label="Account Type"
              isActive={isAccountTypeStep}
              isCompleted={Boolean(accountType)}
              stepNumber={2}
            />
          </div>
        </div>

        {/* Main Content Card */}
        <div className="bg-white rounded-xl shadow-xl p-8">
          {/* Location Step */}
          {isJurisdictionStep && (
            <div>
              <h2 className="text-2xl font-bold text-[#0C141B] mb-2">
                Where is your organization registered?
              </h2>
              <p className="text-gray-600 mb-8">
                Select your country and the accounting framework your
                organization follows
              </p>

              <div className="space-y-6">
                {/* Country select */}
                <div>
                  <label
                    htmlFor="onboarding-country"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Country
                  </label>
                  <select
                    id="onboarding-country"
                    value={country}
                    onChange={handleCountryChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#8b4e52] focus:border-transparent"
                  >
                    {COUNTRIES.map(c => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Accounting Framework radio group */}
                {country && (
                  <fieldset>
                    <legend className="block text-sm font-medium text-gray-700 mb-3">
                      Accounting Framework
                    </legend>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 cursor-pointer hover:border-gray-300 has-[:checked]:border-[#8b4e52] has-[:checked]:bg-[#8b4e52]/5">
                        <input
                          type="radio"
                          name="framework"
                          value="us-gaap"
                          checked={jurisdiction === 'us-gaap'}
                          onChange={handleFrameworkChange}
                          className="w-4 h-4 text-[#8b4e52] focus:ring-[#8b4e52]"
                        />
                        <span className="text-sm text-gray-900">
                          {usGaapLabel}
                        </span>
                      </label>
                      <label className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 cursor-pointer hover:border-gray-300 has-[:checked]:border-[#8b4e52] has-[:checked]:bg-[#8b4e52]/5">
                        <input
                          type="radio"
                          name="framework"
                          value="ifrs"
                          checked={jurisdiction === 'ifrs'}
                          onChange={handleFrameworkChange}
                          className="w-4 h-4 text-[#8b4e52] focus:ring-[#8b4e52]"
                        />
                        <span className="text-sm text-gray-900">
                          {ifrsLabel}
                        </span>
                      </label>
                    </div>
                  </fieldset>
                )}
              </div>
            </div>
          )}

          {/* Account Type Step */}
          {isAccountTypeStep && (
            <div>
              <h2 className="text-2xl font-bold text-[#0C141B] mb-2">
                Select Your Account Type
              </h2>
              <p className="text-gray-600 mb-8">
                Choose the option that best describes your organization
              </p>

              <div className="space-y-4">
                <GridSelectionButton
                  icon={User}
                  title="Individual"
                  description="For personal crypto accounting and tax reporting"
                  subtitle="Single user account with simplified features"
                  isSelected={accountType === 'individual'}
                  onClick={handleSelectIndividual}
                  value="individual"
                  forceLight
                />
                <GridSelectionButton
                  icon={Building2}
                  title="For-Profit Enterprise"
                  description="For businesses managing crypto transactions"
                  subtitle="Multi-user support with admin controls"
                  isSelected={accountType === 'for-profit-enterprise'}
                  onClick={handleSelectSME}
                  value="for-profit-enterprise"
                  forceLight
                />
                <GridSelectionButton
                  icon={Building2}
                  title="Not-for-Profit / NGO"
                  description="For charities and non-profit organizations"
                  subtitle="Specialized reporting for grant management and donor tracking"
                  isSelected={accountType === 'not-for-profit'}
                  onClick={handleSelectNonProfit}
                  value="not-for-profit"
                  forceLight
                />
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={handleBack}
              className={`px-6 py-2 border border-gray-300 rounded-lg font-medium transition-colors ${getBackButtonClassName()}`}
              disabled={isJurisdictionStep}
            >
              Back
            </button>
            <button
              onClick={handleContinue}
              disabled={!canContinue}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${getContinueButtonClassName()}`}
            >
              {getContinueButtonText()}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-600">
          <p>
            Already have an account?{' '}
            <a
              href="/login"
              className="text-[#8b4e52] hover:text-[#7a4248] font-medium"
            >
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Onboarding
