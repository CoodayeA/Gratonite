CREATE TABLE message_edit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  edited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_edit_history_message ON message_edit_history(message_id);
