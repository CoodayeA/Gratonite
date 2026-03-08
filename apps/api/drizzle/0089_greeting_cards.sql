CREATE TABLE greeting_card_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  bg_color TEXT NOT NULL,
  bg_image TEXT,
  font_family TEXT NOT NULL DEFAULT 'serif',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE greeting_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES greeting_card_templates(id),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  stickers JSONB NOT NULL DEFAULT '[]',
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  viewed_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_greeting_cards_recipient ON greeting_cards(recipient_id);
CREATE INDEX idx_greeting_cards_sender ON greeting_cards(sender_id);

-- Default templates
INSERT INTO greeting_card_templates (name, category, bg_color) VALUES
  ('Happy Birthday!', 'birthday', '#FFD700'),
  ('Congratulations!', 'congrats', '#4CAF50'),
  ('Thank You!', 'thanks', '#2196F3'),
  ('Welcome!', 'welcome', '#9C27B0'),
  ('Happy Holidays!', 'holiday', '#F44336');
