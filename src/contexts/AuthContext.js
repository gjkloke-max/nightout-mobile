import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { fetchProfileRow, ensureProfileAfterAuth, ONBOARDING_STEP } from '../services/profileOnboarding'
import { signInWithGoogle, signInWithApple } from '../services/oauthSupabase'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)

  const loadProfile = useCallback(async (u) => {
    if (!supabase || !u?.id) {
      setProfile(null)
      return null
    }
    setProfileLoading(true)
    try {
      let row = await fetchProfileRow(u.id)
      if (!row) {
        row = await ensureProfileAfterAuth(u)
      }
      if (!row) {
        row = {
          id: u.id,
          onboarding_completed: false,
          onboarding_step: ONBOARDING_STEP.ABOUT_YOU,
        }
      }
      setProfile(row)
      return row
    } finally {
      setProfileLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    let mounted = true
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mounted) return
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) await loadProfile(s.user)
      else setProfile(null)
      setLoading(false)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)
      if (s?.user) await loadProfile(s.user)
      else setProfile(null)
    })
    return () => {
      mounted = false
      subscription?.unsubscribe()
    }
  }, [loadProfile])

  const refreshProfile = useCallback(async () => {
    if (user) return loadProfile(user)
    setProfile(null)
    return null
  }, [user, loadProfile])

  const signIn = async (email, password) => {
    if (!supabase) return { data: null, error: { message: 'Supabase not configured' } }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  const signUp = async (email, password, applicationRoleId) => {
    if (!supabase) return { data: null, error: { message: 'Supabase not configured' } }
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (!error && data?.user && applicationRoleId) {
      await supabase.from('user_application_role').insert({
        user_id: data.user.id,
        application_role_id: applicationRoleId,
      })
    }
    return { data, error }
  }

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setProfile(null)
    return { error: null }
  }

  const googleSignIn = async () => {
    const { error } = await signInWithGoogle()
    return { error: error ? { message: error } : null }
  }

  const appleSignIn = async () => {
    const { error, fullName } = await signInWithApple()
    if (error) return { error: { message: error }, fullName: null }
    const {
      data: { session: s },
    } = await supabase.auth.getSession()
    const u = s?.user
    if (u && fullName && (fullName.firstName || fullName.lastName)) {
      await supabase
        .from('profiles')
        .update({
          first_name: fullName.firstName || undefined,
          last_name: fullName.lastName || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', u.id)
    }
    return { error: null, fullName }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        profile,
        profileLoading,
        refreshProfile,
        signIn,
        signUp,
        signOut,
        googleSignIn,
        appleSignIn,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
