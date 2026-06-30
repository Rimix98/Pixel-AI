ALTER TABLE conversations ADD COLUMN IF NOT EXISTS type text DEFAULT 'chat';
