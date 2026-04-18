// Usage: npx tsx src/scripts/set-admin-password.ts <username> <password>
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
dotenv.config()

const [,, username, password] = process.argv
if (!username || !password) {
  console.error('Usage: npx tsx src/scripts/set-admin-password.ts <username> <password>')
  process.exit(1)
}

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const hash = await bcrypt.hash(password, 12)
const { error } = await supabase
  .from('admin_credentials')
  .upsert({ username, password_hash: hash }, { onConflict: 'username' })

if (error) { console.error('Failed:', error.message); process.exit(1) }
console.log(`Admin credential set for "${username}"`)
