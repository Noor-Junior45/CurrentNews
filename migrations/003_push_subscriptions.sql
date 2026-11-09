-- Migration 003: Push notifications subscription storage in Neon PostgreSQL
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id bigserial PRIMARY KEY,
  endpoint text UNIQUE NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_created_at ON push_subscriptions(created_at DESC);
