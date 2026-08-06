import { createClient } from '@supabase/supabase-js'

const strip = (s) => (s?.charCodeAt(0) === 0xFEFF ? s.slice(1) : s ?? '')

export const supabase = createClient(
  strip(import.meta.env.VITE_SUPABASE_URL),
  strip(import.meta.env.VITE_SUPABASE_ANON_KEY)
)
