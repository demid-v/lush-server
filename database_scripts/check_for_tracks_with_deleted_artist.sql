SELECT track.id, track.title, artist.id, artist.name
FROM track, track_artist_rel, artist
WHERE track.id = track_artist_rel.track_id 
AND track_artist_rel.artist_id = artist.id 
AND artist.deleted = 1;