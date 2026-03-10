import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://ltktvmnwsptokdixnsjd.supabase.co',   // reemplazá esto
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0a3R2bW53c3B0b2tkaXhuc2pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzQxNzQsImV4cCI6MjA4ODc1MDE3NH0.yuITzcYunhomYsrjjQJqCSX9hhzocOuuS4k0YvPq8gU'       // reemplazá esto
)