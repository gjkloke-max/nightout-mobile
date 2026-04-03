import { supabase } from '../lib/supabase'

export async function getActiveSession() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: { message: 'User not authenticated' } }
    }

    const { data, error } = await supabase
      .from('chat_session')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      return { data: null, error }
    }

    return { data: data || null, error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}

export async function createNewSession(title = null) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: { message: 'User not authenticated' } }
    }

    await supabase.from('chat_session').update({ is_active: false }).eq('user_id', user.id).eq('is_active', true)

    const { data, error } = await supabase
      .from('chat_session')
      .insert({
        user_id: user.id,
        title: title,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      return { data: null, error }
    }

    return { data, error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}

export async function saveMessage(sessionId, role, content, venues = []) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: { message: 'User not authenticated' } }
    }

    const { data, error } = await supabase
      .from('chat_message')
      .insert({
        chat_session_id: sessionId,
        role: role,
        content: content,
        venues: venues.length > 0 ? venues : null,
      })
      .select()
      .single()

    if (error) {
      return { data: null, error }
    }

    await supabase
      .from('chat_session')
      .update({ updated_at: new Date().toISOString() })
      .eq('chat_session_id', sessionId)

    return { data, error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}

export async function loadSessionMessages(sessionId) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: { message: 'User not authenticated' } }
    }

    const { data, error } = await supabase
      .from('chat_message')
      .select('*')
      .eq('chat_session_id', sessionId)
      .order('created_at', { ascending: true })

    if (error) {
      return { data: null, error }
    }

    const messages = (data || []).map((msg) => {
      let venues = []
      if (msg.venues) {
        try {
          const parsedVenues = typeof msg.venues === 'string' ? JSON.parse(msg.venues) : msg.venues
          if (Array.isArray(parsedVenues)) {
            venues = parsedVenues
          }
        } catch (e) {
          venues = []
        }
      }

      return {
        role: msg.role,
        content: msg.content,
        venues: venues,
      }
    })

    return { data: messages, error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}

export async function loadSession(sessionId) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: { message: 'User not authenticated' } }
    }

    await supabase.from('chat_session').update({ is_active: false }).eq('user_id', user.id).eq('is_active', true)

    const { error: updateError } = await supabase
      .from('chat_session')
      .update({ is_active: true })
      .eq('chat_session_id', sessionId)
      .eq('user_id', user.id)

    if (updateError) {
      return { data: null, error: updateError }
    }

    const { data: messages, error: messagesError } = await loadSessionMessages(sessionId)
    if (messagesError) {
      return { data: null, error: messagesError }
    }

    return { data: { messages }, error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}

export async function loadChatHistory(limit = 50) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: { message: 'User not authenticated' } }
    }

    const { data, error } = await supabase
      .from('chat_session')
      .select('chat_session_id, title, created_at, updated_at, is_active')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (error) {
      return { data: null, error }
    }

    return { data: data || [], error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}

export async function deleteSession(sessionId) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: { message: 'User not authenticated' } }
    }

    const { error } = await supabase
      .from('chat_session')
      .delete()
      .eq('chat_session_id', sessionId)
      .eq('user_id', user.id)

    if (error) {
      return { data: null, error }
    }

    return { data: { success: true }, error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}

export async function updateSessionTitle(sessionId, title) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: { message: 'User not authenticated' } }
    }

    const { data, error } = await supabase
      .from('chat_session')
      .update({ title: title })
      .eq('chat_session_id', sessionId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      return { data: null, error }
    }

    return { data, error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}

export function generateSessionTitle(message) {
  if (!message || message.trim().length === 0) {
    return 'New Chat'
  }

  const cleaned = message
    .replace(/^(can you|please|tell me|i need|i want|i'm looking for|find|show|recommend|suggest)\s+/i, '')
    .trim()
    .substring(0, 50)

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1) || 'New Chat'
}

function stripChatMessagePreview(text) {
  if (!text || typeof text !== 'string') return ''
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export function formatChatRelativeDate(dateStr, opts = {}) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((startOfToday - startOfDay) / (24 * 60 * 60 * 1000))
  const upper = (s) => (opts.uppercase ? s.toUpperCase() : s)
  if (diffDays === 0) return upper('Today')
  if (diffDays === 1) return upper('Yesterday')
  if (diffDays < 7) return upper(`${diffDays} days ago`)
  if (diffDays < 30) return upper(`${Math.floor(diffDays / 7)} weeks ago`)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export async function loadChatHistoryWithPreviews(limit = 50) {
  const { data: sessions, error } = await loadChatHistory(limit)
  if (error) return { data: sessions || [], previews: {}, error }
  if (!sessions?.length) return { data: [], previews: {}, error: null }

  const ids = sessions.map((s) => s.chat_session_id)
  const { data: messages, error: mErr } = await supabase
    .from('chat_message')
    .select('chat_session_id, content, role, created_at')
    .in('chat_session_id', ids)
    .order('created_at', { ascending: false })

  if (mErr) return { data: sessions, previews: {}, error: mErr }

  const previews = {}
  for (const m of messages || []) {
    if (previews[m.chat_session_id]) continue
    const stripped = stripChatMessagePreview(m.content || '').slice(0, 120)
    if (stripped) previews[m.chat_session_id] = stripped
  }
  return { data: sessions, previews, error: null }
}
