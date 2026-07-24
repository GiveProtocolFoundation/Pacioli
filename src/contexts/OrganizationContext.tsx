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
 * OrganizationProvider component that wraps children with organization and user avatar context.
 * @param {object} props - Component props.
 * @param {ReactNode} props.children - Child components to be wrapped by the provider.
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
 * Custom hook to access the OrganizationContext.
 * @throws {Error} When used outside of an OrganizationProvider.
 * @returns {OrganizationContextType} The organization context with logos and setter functions.
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
