/**
 * CRINGE METER — Centralized Supabase Database Service
 * Initializes the authoritative PostgreSQL Supabase client using Service Role credentials.
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
let isConfigured = false;

if (supabaseUrl && supabaseServiceRoleKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    isConfigured = true;
    console.log("[DATABASE] Supabase client initialized successfully.");
  } catch (err) {
    console.error("[DATABASE] Error initializing Supabase client:", err.message);
  }
} else {
  console.warn("\n==================================================================");
  console.warn("⚠️  [DATABASE WARNING] Supabase Cloud Database is NOT configured!");
  console.warn("   Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
  console.warn("   See SUPABASE_SETUP.md for instructions.");
  console.warn("==================================================================\n");
}

async function testConnection() {
  if (!isConfigured || !supabase) {
    return {
      connected: false,
      status: 'NOT_CONFIGURED',
      message: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing'
    };
  }

  try {
    const { data, error } = await supabase.from('users').select('id').limit(1);
    if (error) {
      return {
        connected: false,
        status: 'ERROR',
        message: error.message
      };
    }
    return {
      connected: true,
      status: 'CONNECTED',
      message: 'Connected to Supabase PostgreSQL cloud database'
    };
  } catch (err) {
    return {
      connected: false,
      status: 'UNREACHABLE',
      message: err.message
    };
  }
}

module.exports = {
  supabase,
  isConfigured: () => isConfigured,
  testConnection
};
