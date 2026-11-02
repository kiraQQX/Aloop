/* Public runtime configuration for the Aloop account system.
 *
 * Every value here is shipped to the browser, so only PUBLIC values belong in
 * this file: the Supabase project URL and its publishable (anon) key. Never put
 * a service_role key, a Resend API key or any other secret here - those live in
 * the Supabase dashboard (Authentication -> SMTP Settings), not in this repo.
 *
 * Leave supabaseUrl / supabaseAnonKey empty to run without accounts: the
 * login dialog then says that the account service is not configured.
 */
window.ALOOP_CONFIG = Object.freeze({
  supabaseUrl: "",          // e.g. "https://abcdefghijkl.supabase.co"
  supabaseAnonKey: "",      // Supabase "Publishable key" (anon key)
  siteUrl: "https://aloop.space", // where verification links send people back to
  turnstileSiteKey: "",     // optional Cloudflare Turnstile site key (CAPTCHA); empty = off
});
