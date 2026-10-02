import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { ensureProfileAfterAuth, ONBOARDING_STEP } from '../services/profileOnboarding'
import { signInWithGoogle, signInWithApple } from '../services/oauthSupabase'
import { config } from '../lib/config'

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
      // Always delegate to ensureProfileAfterAuth (not just when no row exists yet) - it does its
      // own fetch first, then also handles the case where a row already exists but is stuck at
      // onboarding_step 'get_started' for an OAuth user (resumes it to 'about_you'). Short-circuiting
      // that call whenever a row already existed skipped the OAuth resume fix entirely.
      let row = await ensureProfileAfterAuth(u)
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
    // NOT an async function, and does not await loadProfile directly. Supabase's own setSession()/
    // signIn() implementations hold their internal session lock while awaiting this callback
    // (_notifyAllSubscribers is awaited inside _acquireLock's callback in auth-js) - awaiting
    // loadProfile() here deadlocks, since it needs to re-acquire that same lock (any .from() query
    // resolves its access token via getSession(), which needs the lock) before the outer caller
    // has released it. setTimeout(..., 0) defers to a new macrotask, after the outer lock releases.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)
      setTimeout(() => {
        if (s?.user) loadProfile(s.user)
        else setProfile(null)
      }, 0)
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

  /**
   * Delete this account for good.
   *
   * Apple requires account deletion to be startable inside the app when the app offers account
   * creation (Guideline 5.1.1(v)); a support email does not satisfy it. Removing an auth user needs
   * credentials no client should hold, so the work happens on the server and this just proves who
   * is asking: the access token goes up, and the server takes the user id from the verified token
   * rather than from anything we send.
   *
   * Signs out on success regardless of what the server says about rows, because the session is
   * worthless once the account behind it is gone.
   */
  const deleteAccount = async () => {
    if (!supabase) return { error: { message: 'Not configured' } }
    const base = String(config.searchApiUrl || '').replace(/\/+$/, '')
    if (!base) return { error: { message: 'Not configured' } }
    try {
      const {
        data: { session: s },
      } = await supabase.auth.getSession()
      const token = s?.access_token
      if (!token) return { error: { message: 'You are signed out. Sign in again to delete your account.' } }

      const res = await fetch(`${base}/api/account/delete`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        return {
          error: {
            message:
              res.status === 401
                ? 'Your session expired. Sign in again and retry.'
                : body?.error === 'delete_failed'
                  ? 'Something went wrong deleting your account. Please try again.'
                  : 'Account deletion is unavailable right now. Please try again later.',
          },
        }
      }
      await signOut()
      return { error: null }
    } catch (e) {
      return { error: { message: e?.message || 'Could not reach the server.' } }
    }
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
        deleteAccount,
        googleSignIn,
        appleSignIn,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
