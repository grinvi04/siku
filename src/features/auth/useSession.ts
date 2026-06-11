import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { supabase } from '../../data/supabase'

interface SessionState {
  session: Session | null
  loading: boolean
}

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ session: null, loading: true })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setState({ session: data.session, loading: false })
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, loading: false })
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return state
}
