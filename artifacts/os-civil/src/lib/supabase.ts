// This file has been intentionally emptied.
// All data persistence now goes through the Express API server.
// The Supabase bypass functions that used to live here were silently failing
// because VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set in this
// environment, causing every write to be dropped on the floor.
//
// DO NOT add new exports here. Use the generated API client hooks instead.
export {};
