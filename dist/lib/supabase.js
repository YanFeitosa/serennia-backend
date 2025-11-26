"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = exports.supabaseAdmin = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY; // Secret key for backend (bypasses RLS)
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY; // Publishable key for user operations
if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY must be set in environment variables. ' +
        'Please check your .env file in the backend directory.');
}
// Admin client for backend operations (bypasses Row Level Security)
exports.supabaseAdmin = (0, supabase_js_1.createClient)(supabaseUrl, supabaseSecretKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});
// Regular client for user operations (respects RLS)
// Falls back to secret key if publishable key is not provided (for development)
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabasePublishableKey || supabaseSecretKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});
