// Shared row shapes used across the app.
// Phase B will regenerate real Database types via `supabase gen types typescript`;
// for now we keep the Supabase client untyped and share row types from here.

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  timezone: string;
  coin_balance: number;
  lifetime_coins: number;
  global_opt_in: boolean;
  created_at: string;
};

export type ProfileLookup = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

export type Friendship = {
  user_id: string;
  friend_id: string;
  status: "pending" | "accepted";
  created_at: string;
};
