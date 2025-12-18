import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Globe, Building2, User, Check, LucideIcon } from 'lucide-react'
import PacioliBlackLogo from '../../assets/Pacioli_logo_black.svg'

type Step = 'jurisdiction' | 'account-type' | 'complete'
type Jurisdiction = 'us-gaap' | 'ifrs'
type AccountType = 'individual' | 'for-profit-enterprise' | 'not-for-profit'

interface ProgressStepProps {
  label: string
  isActive: boolean
  isCompleted: boolean
  stepNumber: number
}

const ProgressStep: React.FC<ProgressStepProps> = ({
  label,
  isActive,
  isCompleted,
  stepNumber,
}) => {
  const getStepClassName = () => {
    if (isActive) return 'bg-blue-600 text-white'
    if (isCompleted) return 'bg-green-600 text-white'
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

const ProgressConnector: React.FC<ProgressConnectorProps> = ({
  isCompleted,
}) => (
  <div className="w-16 h-1 bg-gray-300">
    <div
      className={`h-full transition-all ${isCompleted ? 'bg-blue-600 w-full' : 'bg-transparent w-0'}`}
    />
  </div>
)

interface SelectionButtonProps<T> {
  icon: LucideIcon
  title: string
  description: string
  subtitle: string
  isSelected: boolean
  onClick: () => void
  value: T
}

function SelectionButton<T>({
  icon: Icon,
  title,
  description,
  subtitle,
  isSelected,
  onClick,
}: SelectionButtonProps<T>) {
  const getButtonClassName = () => {
    return isSelected
      ? 'border-blue-600 bg-blue-50 shadow-md'
      : 'border-gray-200 hover:border-gray-300'
  }

  const getIconContainerClassName = () => {
    return isSelected ? 'bg-blue-600' : 'bg-gray-100'
  }

  const getIconClassName = () => {
    return isSelected ? 'text-white' : 'text-gray-600'
  }

  return (
    <button
      onClick={onClick}
      className={`p-6 border-2 rounded-xl transition-all hover:shadow-lg ${getButtonClassName()}`}
    >
      <div className="flex items-start space-x-4">
        <div
          className={`w-12 h-12 rounded-lg flex items-center justify-center ${getIconContainerClassName()}`}
        >
          <Icon className={`w-6 h-6 ${getIconClassName()}`} />
        </div>
        <div className="flex-1 text-left">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
function SelectionDetails({description, subtitle}: {description: string; subtitle: string}) {
  return (
    <div className="flex flex-col items-start space-y-1">
      <p className="text-sm text-gray-600">{description}</p>
      <p className="text-xs text-gray-500 mt-2">{subtitle}</p>
    </div>
  )
}

function SelectionButton<T>({
  icon: Icon,
  title,
  description,
  subtitle,
  isSelected,
  onClick,
  value
}: SelectionButtonProps<T>) {
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className="w-full bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      <div className="flex items-center space-x-3">
        <Icon className="w-6 h-6 text-gray-900 shrink-0" />
        <SelectionDetails description={description} subtitle={subtitle} />
        {isSelected && (
          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
            <Check className="w-4 h-4 text-white" />
          </div>
        )}
      </div>
    </button>
  )
}

interface GridSelectionButtonProps<T> extends SelectionButtonProps<T> {
  gridLayout?: boolean
}

function GridSelectionButton<T>(props: GridSelectionButtonProps<T>) {
  return (
    <div className={props.gridLayout ? '' : 'w-full'}>
      <SelectionButton {...props} />
    </div>
  )
}

const Onboarding: React.FC = () => {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState<Step>('jurisdiction')
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction | null>(null)
  const [accountType, setAccountType] = useState<AccountType | null>(null)

  const handleJurisdictionSelect = useCallback((selected: Jurisdiction) => {
    setJurisdiction(selected)
  }, [])

  const handleAccountTypeSelect = useCallback((selected: AccountType) => {
    setAccountType(selected)
  }, [])

  const handleContinue = useCallback(() => {
    if (currentStep === 'jurisdiction' && jurisdiction) {
      setCurrentStep('account-type')
    } else if (currentStep === 'account-type' && accountType) {
      // TODO: Save to backend/context
      // Selected: { jurisdiction, accountType }
      // Navigate to dashboard
      navigate('/dashboard')
    }
  }, [currentStep, jurisdiction, accountType, navigate])

  const handleBack = useCallback(() => {
    if (currentStep === 'account-type') {
      setCurrentStep('jurisdiction')
    }
  }, [currentStep])

  const handleSelectUSGAAP = useCallback(() => {
    handleJurisdictionSelect('us-gaap')
  }, [handleJurisdictionSelect])

  const handleSelectIFRS = useCallback(() => {
    handleJurisdictionSelect('ifrs')
  }, [handleJurisdictionSelect])

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
    (currentStep === 'jurisdiction' && jurisdiction) ||
    (currentStep === 'account-type' && accountType)

  const isJurisdictionStep = currentStep === 'jurisdiction'
  const isAccountTypeStep = currentStep === 'account-type'

  const getBackButtonClassName = () => {
    return isJurisdictionStep
      ? 'text-gray-400 cursor-not-allowed'
      : 'text-gray-700 hover:bg-gray-50'
  }

  const getContinueButtonClassName = () => {
    return canContinue
      ? 'bg-blue-600 text-white hover:bg-blue-700'
      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
  }

  const getContinueButtonText = () => {
    return isAccountTypeStep ? 'Complete Setup' : 'Continue'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
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
              label="Jurisdiction"
              isActive={isJurisdictionStep}
              isCompleted={Boolean(jurisdiction)}
              stepNumber={1}
            />
            <ProgressConnector isCompleted={Boolean(jurisdiction)} />
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
          {/* Jurisdiction Step */}
          {isJurisdictionStep && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Select Your Jurisdiction
              </h2>
              <p className="text-gray-600 mb-8">
                Choose the accounting standard that applies to your organization
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <GridSelectionButton
                  icon={Globe}
                  title="United States"
                  description="US GAAP (Generally Accepted Accounting Principles)"
                  subtitle="For organizations operating in the United States"
                  isSelected={jurisdiction === 'us-gaap'}
                  onClick={handleSelectUSGAAP}
                  value="us-gaap"
                  gridLayout
                />
                <GridSelectionButton
                  icon={Globe}
                  title="International"
                  description="IFRS (International Financial Reporting Standards)"
                  subtitle="For organizations operating internationally"
                  isSelected={jurisdiction === 'ifrs'}
                  onClick={handleSelectIFRS}
                  value="ifrs"
                  gridLayout
                />
              </div>
            </div>
          )}

          {/* Account Type Step */}
          {isAccountTypeStep && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
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
                />
                <GridSelectionButton
                  icon={Building2}
                  title="For-Profit Enterprise"
                  description="For businesses managing crypto transactions"
                  subtitle="Multi-user support with admin controls"
                  isSelected={accountType === 'for-profit-enterprise'}
                  onClick={handleSelectSME}
                  value="for-profit-enterprise"
                />
                <GridSelectionButton
                  icon={Building2}
                  title="Not-for-Profit / NGO"
                  description="For charities and non-profit organizations"
                  subtitle="Specialized reporting for grant management and donor tracking"
                  isSelected={accountType === 'not-for-profit'}
                  onClick={handleSelectNonProfit}
                  value="not-for-profit"
                />
              </div>
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
              className="text-blue-600 hover:text-blue-700 font-medium"
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
