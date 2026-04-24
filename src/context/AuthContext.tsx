// src/context/AuthContext.tsx
// MIGRATED: Supabase auth → NextAuth via AzureAuthContext
// All exports preserved for zero-change consumer compatibility.
// This file now re-exports from AzureAuthContext.

export {
  AzureAuthProvider as AuthProvider,
  useAzureAuth as useAuth,
  useAzureAuth,
} from './AzureAuthContext'
