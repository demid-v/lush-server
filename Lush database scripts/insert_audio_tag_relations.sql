DROP PROCEDURE IF EXISTS insert_audio_tag_relations;
DELIMITER ;;

CREATE PROCEDURE insert_audio_tag_relations(artist_id_passed INT)
BEGIN
	DECLARE n INT DEFAULT 0;
	DECLARE i INT DEFAULT 0;
    
  DECLARE CONTINUE HANDLER FOR 1062
	BEGIN
	  SELECT 'Duplicate key occurred';
	END;
	
  SELECT COUNT(*) 
  FROM audio, audio_artist, artist 
  WHERE audio.id = audio_artist.audio_id
    AND artist.id = audio_artist.artist_id
    AND artist.id = artist_id_passed
  INTO n;
	
  SET i = 0;
	WHILE i < n DO 
		INSERT INTO audio_tag
    SELECT audio.id, 30
    FROM audio, audio_artist, artist 
    WHERE audio.id = audio_artist.audio_id
      AND artist.id = audio_artist.artist_id
      AND artist.id = artist_id_passed
    LIMIT i, 1;
	  
		SET i = i + 1;
	END WHILE;
END;
;;

DELIMITER ;