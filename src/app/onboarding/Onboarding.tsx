import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, Building2, User, Check } from 'lucide-react';
import NumbersBlackLogo from '../../assets/Numbers_Black.svg';

type Step = 'jurisdiction' | 'account-type' | 'complete';
type Jurisdiction = 'us-gaap' | 'ifrs';
type AccountType = 'individual' | 'sme' | 'not-for-profit';

const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>('jurisdiction');
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction | null>(null);
  const [accountType, setAccountType] = useState<AccountType | null>(null);

  const handleJurisdictionSelect = (selected: Jurisdiction) => {
    setJurisdiction(selected);
  };

  const handleAccountTypeSelect = (selected: AccountType) => {
    setAccountType(selected);
  };

  const handleContinue = () => {
    if (currentStep === 'jurisdiction' && jurisdiction) {
      setCurrentStep('account-type');
    } else if (currentStep === 'account-type' && accountType) {
      // TODO: Save to backend/context
      // Selected: { jurisdiction, accountType }
      // Navigate to dashboard
      navigate('/dashboard');
    }
  };

  const handleBack = () => {
    if (currentStep === 'account-type') {
      setCurrentStep('jurisdiction');
    }
  };

  const canContinue =
    (currentStep === 'jurisdiction' && jurisdiction) ||
    (currentStep === 'account-type' && accountType);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <img src={NumbersBlackLogo} alt="Numbers" className="h-12 w-auto" />
            <span className="ml-3 text-2xl font-bold text-gray-900">Numbers</span>
          </div>
          <p className="text-gray-600">Let&apos;s set up your account</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
            <div className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                currentStep === 'jurisdiction'
                  ? 'bg-blue-600 text-white'
                  : jurisdiction
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-600'
              }`}>
                {jurisdiction ? <Check className="w-5 h-5" /> : '1'}
              </div>
              <span className="ml-2 text-sm font-medium text-gray-700">Jurisdiction</span>
            </div>
            <div className="w-16 h-1 bg-gray-300">
              <div className={`h-full transition-all ${jurisdiction ? 'bg-blue-600 w-full' : 'bg-transparent w-0'}`} />
            </div>
            <div className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                currentStep === 'account-type'
                  ? 'bg-blue-600 text-white'
                  : accountType
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-600'
              }`}>
                {accountType ? <Check className="w-5 h-5" /> : '2'}
              </div>
              <span className="ml-2 text-sm font-medium text-gray-700">Account Type</span>
            </div>
          </div>
        </div>

        {/* Main Content Card */}
        <div className="bg-white rounded-xl shadow-xl p-8">
          {/* Jurisdiction Step */}
          {currentStep === 'jurisdiction' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Your Jurisdiction</h2>
              <p className="text-gray-600 mb-8">Choose the accounting standard that applies to your organization</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* US GAAP Option */}
                <button
                  onClick={() => handleJurisdictionSelect('us-gaap')}
                  className={`p-6 border-2 rounded-xl transition-all hover:shadow-lg ${
                    jurisdiction === 'us-gaap'
                      ? 'border-blue-600 bg-blue-50 shadow-md'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      jurisdiction === 'us-gaap' ? 'bg-blue-600' : 'bg-gray-100'
                    }`}>
                      <Globe className={`w-6 h-6 ${
                        jurisdiction === 'us-gaap' ? 'text-white' : 'text-gray-600'
                      }`} />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">United States</h3>
                      <p className="text-sm text-gray-600">US GAAP (Generally Accepted Accounting Principles)</p>
                      <p className="text-xs text-gray-500 mt-2">For organizations operating in the United States</p>
                    </div>
                    {jurisdiction === 'us-gaap' && (
                      <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </button>

                {/* IFRS Option */}
                <button
                  onClick={() => handleJurisdictionSelect('ifrs')}
                  className={`p-6 border-2 rounded-xl transition-all hover:shadow-lg ${
                    jurisdiction === 'ifrs'
                      ? 'border-blue-600 bg-blue-50 shadow-md'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      jurisdiction === 'ifrs' ? 'bg-blue-600' : 'bg-gray-100'
                    }`}>
                      <Globe className={`w-6 h-6 ${
                        jurisdiction === 'ifrs' ? 'text-white' : 'text-gray-600'
                      }`} />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">International</h3>
                      <p className="text-sm text-gray-600">IFRS (International Financial Reporting Standards)</p>
                      <p className="text-xs text-gray-500 mt-2">For organizations operating internationally</p>
                    </div>
                    {jurisdiction === 'ifrs' && (
                      <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Account Type Step */}
          {currentStep === 'account-type' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Your Account Type</h2>
              <p className="text-gray-600 mb-8">Choose the option that best describes your organization</p>

              <div className="space-y-4">
                {/* Individual Option */}
                <button
                  onClick={() => handleAccountTypeSelect('individual')}
                  className={`w-full p-6 border-2 rounded-xl transition-all hover:shadow-lg ${
                    accountType === 'individual'
                      ? 'border-blue-600 bg-blue-50 shadow-md'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      accountType === 'individual' ? 'bg-blue-600' : 'bg-gray-100'
                    }`}>
                      <User className={`w-6 h-6 ${
                        accountType === 'individual' ? 'text-white' : 'text-gray-600'
                      }`} />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Individual</h3>
                      <p className="text-sm text-gray-600">For personal crypto accounting and tax reporting</p>
                      <p className="text-xs text-gray-500 mt-2">Single user account with simplified features</p>
                    </div>
                    {accountType === 'individual' && (
                      <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </button>

                {/* SME Option */}
                <button
                  onClick={() => handleAccountTypeSelect('sme')}
                  className={`w-full p-6 border-2 rounded-xl transition-all hover:shadow-lg ${
                    accountType === 'sme'
                      ? 'border-blue-600 bg-blue-50 shadow-md'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      accountType === 'sme' ? 'bg-blue-600' : 'bg-gray-100'
                    }`}>
                      <Building2 className={`w-6 h-6 ${
                        accountType === 'sme' ? 'text-white' : 'text-gray-600'
                      }`} />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Small & Medium Enterprise (SME)</h3>
                      <p className="text-sm text-gray-600">For businesses managing crypto transactions</p>
                      <p className="text-xs text-gray-500 mt-2">Multi-user support with admin controls</p>
                    </div>
                    {accountType === 'sme' && (
                      <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </button>

                {/* Not-for-Profit Option */}
                <button
                  onClick={() => handleAccountTypeSelect('not-for-profit')}
                  className={`w-full p-6 border-2 rounded-xl transition-all hover:shadow-lg ${
                    accountType === 'not-for-profit'
                      ? 'border-blue-600 bg-blue-50 shadow-md'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      accountType === 'not-for-profit' ? 'bg-blue-600' : 'bg-gray-100'
                    }`}>
                      <Building2 className={`w-6 h-6 ${
                        accountType === 'not-for-profit' ? 'text-white' : 'text-gray-600'
                      }`} />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Not-for-Profit / NGO</h3>
                      <p className="text-sm text-gray-600">For charities and non-profit organizations</p>
                      <p className="text-xs text-gray-500 mt-2">Specialized reporting for grant management and donor tracking</p>
                    </div>
                    {accountType === 'not-for-profit' && (
                      <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
            <button
              onClick={handleBack}
              className={`px-6 py-2 border border-gray-300 rounded-lg font-medium transition-colors ${
                currentStep === 'jurisdiction'
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
              disabled={currentStep === 'jurisdiction'}
            >
              Back
            </button>
            <button
              onClick={handleContinue}
              disabled={!canContinue}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                canContinue
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {currentStep === 'account-type' ? 'Complete Setup' : 'Continue'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-gray-600">
          <p>Already have an account? <a href="/login" className="text-blue-600 hover:text-blue-700 font-medium">Sign in</a></p>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
