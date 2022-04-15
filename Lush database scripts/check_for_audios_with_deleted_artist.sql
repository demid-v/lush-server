SELECT audio.id, audio.title, artist.id, artist.name
FROM audio, audio_artist, artist
WHERE audio.id = audio_artist.audio_id
  AND audio_artist.artist_id = artist.id
  AND artist.deleted = 1;