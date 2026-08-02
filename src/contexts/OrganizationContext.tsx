/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, ReactNode } from 'react'

interface OrganizationContextType {
  organizationLogo: string | null
  setOrganizationLogo: (logo: string | null) => void
  userAvatar: string | null
  setUserAvatar: (avatar: string | null) => void
}

// skipcq: JS-W1042
const OrganizationContext = createContext<OrganizationContextType | undefined>(
  undefined
)

/**
 * Provides organization and user avatar context to child components.
 *
 * @param props - Component props.
 * @param props.children - Child components to render within the provider.
 * @returns The context provider wrapping children.
 */
export const OrganizationProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [organizationLogo, setOrganizationLogo] = useState<string | null>(null)
  const [userAvatar, setUserAvatar] = useState<string | null>(null)

  return (
    <OrganizationContext.Provider
      value={{
        organizationLogo,
        setOrganizationLogo,
        userAvatar,
        setUserAvatar,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  )
}

/**
 * Custom hook to access organization context.
 *
 * @returns The organization context value.
 * @throws Error if used outside of OrganizationProvider.
 */
export const useOrganization = () => {
  const context = useContext(OrganizationContext)
  if (context === undefined) {
    throw new Error(
      'useOrganization must be used within an OrganizationProvider'
    )
  }
  return context
}
