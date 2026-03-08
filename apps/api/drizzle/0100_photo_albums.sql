CREATE TABLE photo_albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id UUID NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_photo_albums_guild ON photo_albums(guild_id);

CREATE TABLE photo_album_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id UUID NOT NULL REFERENCES photo_albums(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  caption TEXT,
  added_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_photo_album_items_album ON photo_album_items(album_id);
