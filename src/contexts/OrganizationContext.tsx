/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, ReactNode } from 'react'

interface OrganizationContextType {
  organizationLogo: string | null
  setOrganizationLogo: (logo: string | null) => void
  userAvatar: string | null
  setUserAvatar: (avatar: string | null) => void
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(
  undefined
)

/**
 * Provides organization and user avatar context to its child components.
 *
 * @param {{ children: ReactNode }} props - The component props.
 * @param {ReactNode} props.children - The child components that require organization context.
 * @returns {JSX.Element} The context provider wrapping the children.
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
 * Custom hook to consume the OrganizationContext.
 *
 * @returns {OrganizationContextType} The current organization context values and setters.
 * @throws {Error} If used outside of an OrganizationProvider.
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
