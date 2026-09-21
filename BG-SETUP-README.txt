BHAVISHYA GYANI — FULL WORKING CHAT SETUP

1. Replace the GitHub project files with the contents of this ZIP (keep the project root, do not create a nested bhavishya-gyani-main/bhavishya-gyani-main folder).
2. Vercel Environment Variables must contain: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
3. Supabase SQL Editor: run ONLY supabase/BHAVISHYA-GYANI-FINAL-CHAT-SETUP.sql. It is additive/idempotent and does not delete existing users/messages.
4. Redeploy Vercel. Hard-refresh the browser once. The service-worker version is bumped to bg-v11.
5. User flow: Login -> Dashboard -> Profile / Chat / Call. Chat request -> astrologer Accept -> user Confirm -> active chat. Messages are stored permanently in Supabase.
6. Admin support: Dashboard -> Admin Support Chat.
7. Socket.IO is retained and attempted first; private Supabase Realtime + REST polling are the fallback, so chat remains usable if a WebSocket connection is temporarily unavailable.
