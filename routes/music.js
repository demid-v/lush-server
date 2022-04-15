const router = require("express").Router();

const {
  resolveQuery,
  constructWhereClause,
  audiosGroupBy,
  findGenre,
  deleteAudioGenreRelations,
  escapeMySQLString,
  insertArtistImage,
  insertImageArtistRelation,
  getAlbum,
} = require("../general.js");

router.post("/audiosData", async function (req, res) {
  console.log("Body:", req.body);

  const dataRequest = req.body;
  const audioData = await fetchAudioData(dataRequest);

  res.send(audioData);
});

router.patch("/editAudio", async function (req, res) {
  console.log("Body:", req.body);

  const dataRequest = req.body.dataRequest;
  const { audioId, title, artists, genres } = dataRequest;

  await editAudioTitle(audioId, title);

  await deleteAudioArtistRelations(audioId);
  artists.forEach(async (artistId, index) => {
    if (artistId !== undefined) {
      await insertAudioArtistRelation(audioId, artistId, index + 1);
    }
  });

  await deleteAudioGenreRelations(audioId);
  genres.forEach(async (genreId, index) => {
    if (genreId !== undefined) {
      await insertAudioGenreRelations(audioId, genreId, index + 1);
    }
  });

  const audioData = await fetchAudioDataById(audioId);

  res.send(audioData);
});

async function editAudioTitle(audioId, title) {
  const query = `
  UPDATE audio
  SET title = "${title}"
  WHERE id = ${audioId}
  ;`;

  return await resolveQuery(query);
}

async function fetchAudioDataById(audioId) {
  const result = await getAudioMetadataById(audioId);

  var audios = result.data?.map((audio) => ({ ...audio })) || [];
  audios = audiosGroupBy(audios, "audio_id");
  audios = Object.values(audios)[0];

  const audiosData = {
    status: result.error || 200,
    audio: audios,
  };

  return audiosData;
}

async function getAudioMetadataById(audioId) {
  const query = `
  SELECT audio_id AS audio_id, blob_id, title, artist.id AS artist_id, artist.name, duration 
  FROM audio
  INNER JOIN audio_artist 
  ON audio.id = audio_artist.audio_id
  INNER JOIN artist 
  ON audio_artist.artist_id = artist.id
  WHERE audio_id = ${audioId}
  ;`;

  return await resolveQuery(query);
}

async function deleteAudioArtistRelations(audioId) {
  const query = `
  DELETE FROM audio_artist
  WHERE audio_id = ${audioId}
  ;`;

  return await resolveQuery(query);
}

async function insertAudioArtistRelation(audioId, artistId, artistPosition) {
  const query = `
  INSERT INTO audio_artist(audio_id, artist_id, artist_position) 
  VALUES(${audioId}, ${artistId}, ${artistPosition})
  ;`;

  return await resolveQuery(query);
}

async function insertAudioGenreRelations(audioId, genreId, genrePosition) {
  const query = `
  INSERT INTO audio_genre(audio_id, genre_id, genre_position) 
  VALUES(${audioId}, ${genreId}, ${genrePosition})
  ;`;

  return await resolveQuery(query);
}

async function fetchAudioData(dataRequest) {
  const result = await getAudioMetadata(dataRequest);

  const status = result.error || 200;
  var audios = result.data?.map((audio) => ({ ...audio })) || [];
  audios = audiosGroupBy(audios, "audio_id");
  audios = Array.from(audios.values());
  audios.forEach((audio) => {
    audio.artists = Object.values(audio.artists);
    audio.artists.sort((a, b) => a.position - b.position);

    audio.genres = Object.values(audio.genres);
    audio.genres.sort((a, b) => a.position - b.position);
  });

  const audiosData = {
    status: status,
    audios: audios,
  };

  return audiosData;
}

async function getAudioMetadata({
  artistId,
  playlistId,
  albumId,
  search,
  genres,
  shuffle,
  limit,
  offset,
}) {
  const queryWhereClauses = [
    // "audio.deleted = 0"
  ];
  const subqueryWhereClauses = [
    // "audio.deleted = 0"
  ];

  // Should always set this censorship when presenting the project.
  // const NSFWClause = "audio.nsfw = 0";
  // subqueryWhereClauses.push(NSFWClause);

  if (artistId) {
    const artistIdWhereClause = `
    artist.id = ${artistId}
    `;

    queryWhereClauses.push(artistIdWhereClause);
    subqueryWhereClauses.push(artistIdWhereClause);
  }

  if (playlistId) {
    const playlistIdWhereClause = `
    playlist.id = ${playlistId}
    `;

    queryWhereClauses.push(playlistIdWhereClause);
    subqueryWhereClauses.push(playlistIdWhereClause);
  }

  if (albumId) {
    const albumIdWhereClause = `
    album.id = ${albumId}
    `;

    queryWhereClauses.push(albumIdWhereClause);
    subqueryWhereClauses.push(albumIdWhereClause);
  }

  if (search) {
    const searchQuery = `
      CONCAT(artist.name, " ", audio.title) COLLATE utf8mb4_0900_ai_ci LIKE "%${search}%"
      `;
    //   `
    // (
    //   audio.title COLLATE utf8mb4_0900_ai_ci LIKE "%${search}%"
    //   OR artist.name COLLATE utf8mb4_0900_ai_ci LIKE "%${search}%"
    // )
    // `;

    queryWhereClauses.push(searchQuery);
    subqueryWhereClauses.push(searchQuery);
  }

  if (genres) {
    const queryWhereClausesOr = [];
    const subqueryWhereClausesOr = [];

    genres.forEach((genre) => {
      const genreQuery = `
      genre.name COLLATE utf8mb4_0900_ai_ci = "${genre}"
      `;
      subqueryWhereClausesOr.push(genreQuery);
      queryWhereClausesOr.push(genreQuery);
    });

    const genresSubquery = constructWhereClause(
      subqueryWhereClausesOr,
      "OR",
      true
    );
    const genresQuery = constructWhereClause(queryWhereClausesOr, "OR", true);

    subqueryWhereClauses.push(genresSubquery);
    queryWhereClauses.push(genresQuery);
  }

  const queryWhereClause = constructWhereClause(queryWhereClauses);

  let orderBy;
  if (shuffle) {
    orderBy = "RAND()";
  } else if (playlistId) {
    orderBy = "audio_playlist.audio_position";
  } else if (albumId) {
    orderBy = "audio_album.audio_position";
  } else {
    orderBy = "audio.id DESC";
  }

  if (!shuffle) {
    const subquery = `
    audio.id <= 
      (
        SELECT audio.id 
        FROM audio 

        LEFT JOIN audio_artist 
        ON audio.id = audio_artist.audio_id
        LEFT JOIN artist 
        ON audio_artist.artist_id = artist.id
        
        LEFT JOIN audio_playlist 
        ON audio.id = audio_playlist.audio_id
        LEFT JOIN playlist 
        ON audio_playlist.playlist_id = playlist.id
        
        LEFT JOIN audio_genre 
        ON audio.id = audio_genre.audio_id
        LEFT JOIN genre 
        ON audio_genre.genre_id = genre.id        
        AND genre.deleted = 0
    
        LEFT JOIN audio_album 
        ON audio.id = audio_album.audio_id
        LEFT JOIN album 
        ON audio_album.album_id = album.id

        ${queryWhereClause}
        GROUP BY audio.id
        ORDER BY audio.id DESC
        LIMIT 1 OFFSET ${offset}
      )
    `;

    subqueryWhereClauses.push(subquery);
  }

  const subqueryWhereClause = constructWhereClause(subqueryWhereClauses);

  const query = `
  SELECT audio.id AS audio_id, blob_id, audio.title AS audio_title, artist.id AS artist_id, artist.name, 
  artist_position, duration, audio.youtube_video_id, genre.id AS genre_id, genre.name AS genre_name, 
  audio_genre.genre_position AS genre_position, artistimage_b.image_id, domain.id AS domain_id, domain.name AS domain_name,
  album.id AS album_id, album.title AS album_title, albumimage.image_id AS album_image_id, album_domain.id AS album_domain_id, album_domain.name AS album_domain_name
  FROM (
    SELECT audio.id, blob_id, audio.title, duration, audio.youtube_video_id
    FROM audio
    
    LEFT JOIN audio_artist 
    ON audio.id = audio_artist.audio_id
    LEFT JOIN artist 
    ON audio_artist.artist_id = artist.id
    
    LEFT JOIN audio_playlist 
    ON audio.id = audio_playlist.audio_id
    LEFT JOIN playlist 
    ON audio_playlist.playlist_id = playlist.id
    
    LEFT JOIN audio_genre 
    ON audio.id = audio_genre.audio_id
    LEFT JOIN genre 
    ON audio_genre.genre_id = genre.id
    AND genre.deleted = 0
    
    LEFT JOIN audio_album 
    ON audio.id = audio_album.audio_id
    LEFT JOIN album 
    ON audio_album.album_id = album.id

    ${subqueryWhereClause}
    GROUP BY audio.id
    ORDER BY ${orderBy}
    LIMIT ${limit}
    ) audio

  LEFT JOIN audio_artist 
  ON audio.id = audio_artist.audio_id
  LEFT JOIN artist 
  ON audio_artist.artist_id = artist.id
  LEFT JOIN image_artist_b
  ON artist.id = image_artist_b.artist_id
  AND image_artist_b.is_cover = 1
  LEFT JOIN artistimage_b
  ON image_artist_b.image_id = artistimage_b.id
  LEFT JOIN domain
  ON artistimage_b.domain_id = domain.id

  LEFT JOIN audio_playlist 
  ON audio.id = audio_playlist.audio_id
  LEFT JOIN playlist 
  ON audio_playlist.playlist_id = playlist.id
  
  LEFT JOIN audio_genre 
  ON audio.id = audio_genre.audio_id
  LEFT JOIN genre 
  ON audio_genre.genre_id = genre.id
  AND genre.deleted = 0
  
  LEFT JOIN audio_album 
  ON audio.id = audio_album.audio_id
  LEFT JOIN album 
  ON audio_album.album_id = album.id
  LEFT JOIN image_album
  ON album.id = image_album.album_id
  AND image_album.is_cover = 1
  LEFT JOIN albumimage
  ON image_album.image_id = albumimage.id
  LEFT JOIN domain AS album_domain
  ON albumimage.domain_id = album_domain.id
  ;`;

  // console.log(query);

  return await resolveQuery(query);
}

async function getAudio(audioId) {
  const query = `
  SELECT audio
  FROM audio_blob
  WHERE id = ${audioId}
  ;`;

  return await resolveQuery(query);
}

async function insertAudioLanguageRelation(audioId, languageId) {
  const query = `
  INSERT INTO audio_language(audio_id, language_id) 
  VALUES(${audioId}, ${languageId})
  ;`;

  return await resolveQuery(query);
}

router.get("/randomAudio", async function (req, res, _next) {
  // console.log("Body:", req.body);

  const dataRequest = { shuffle: true, limit: 3 };
  const result = await getAudioMetadata(dataRequest);

  const status = result.error || 200;
  var audiosData = result.data?.map((audio) => ({ ...audio })) || [];
  audiosData = audiosGroupBy(audiosData, "audio_id");
  audiosData = Array.from(audiosData.values());
  audiosData.forEach((audioData) => {
    audioData.artists = Object.values(audioData.artists);
    audioData.artists.sort((a, b) => a.position - b.position);
    audioData.genres = Object.values(audioData.genres);
    audioData.genres.sort((a, b) => a.position - b.position);
  });

  const data = {
    status: status,
    audiosData: audiosData,
    // body: bodyReq,
  };

  res.send(data);
});

router.post("/downloadAudios", async function (req, res) {
  const blobId = req.body.blobId;
  const result = await getAudio(blobId);
  const audioData = {
    status: result.error || 200,
    blob: result.data[0].audio,
  };

  res.write(audioData.blob);
  res.end();
});

const request = require("request");

router.post("/getLastFmPage", async function (req, res) {
  var url = req.body.url;
  if (!url.includes("https://www.last.fm/")) {
    url = "https://www.last.fm/" + url;
  }

  await Promise.resolve(
    new Promise((res) => {
      request(url, function (error, response, body) {
        if (error) console.log(error);

        res(body);
      });
    })
  ).then((body) => res.send(body));
});

router.post("/uploadArtistImage", async (req, res) => {
  const { artistId, artistImage } = req.body;

  if (!(await getArtistImageByName(artistImage.id)).data[0]?.id) {
    var isCover = 1;
    if ((await getArtistImageByArtistId(artistId)).data[0]?.id) {
      isCover = 0;
    }
    const artistImageId = (
      await insertArtistImage(2, artistImage.id, artistImage.rgb)
    ).data.insertId;
    await insertImageArtistRelation(artistImageId, artistId, isCover);
  }

  res.send({ status: 200, artistImage, message: "Artist image uploaded." });
});

router.post("/uploadAlbum", async function (req, res) {
  const {
    artistId,
    artistName,
    albumTitle,
    tracks,
    genres,
    albumCover,
    releaseDate,
    mbid,
  } = req.body;

  var albumId = (await getAlbum(artistId, albumTitle)).data[0]?.id;
  if (albumId == null) {
    albumId = (await insertAlbum(albumTitle, releaseDate, mbid)).data.insertId;

    for (const [index, track] of tracks.entries()) {
      var audioId = (await getAudioId(artistId, track.title)).data[0]?.id;
      if (audioId === undefined) {
        audioId = (
          await insertPhantomAudioData(
            track.title,
            track.duration,
            track.mbid,
            track.videoId
          )
        ).data.insertId;
        await insertAudioLanguageRelation(audioId, 1);
        await insertAudioArtistRelation(audioId, artistId, 1);
      }

      if (track.genres?.length > 0) {
        track.genres.forEach(async (genre, index) => {
          const genreId =
            (await findGenre(genre)).data[0]?.id ||
            (await insertGenre(genre, 1)).data?.insertId;
          const audioGenreRel = (await getAudioGenreRelation(audioId, genreId))
            .data;
          if (audioGenreRel?.length < 1) {
            await insertAudioGenreRelations(audioId, genreId, index + 1);
          }
        });
      } else if (genres?.length > 0) {
        genres.forEach(async (genre, index) => {
          const genreId =
            (await findGenre(genre)).data[0]?.id ||
            (await insertGenre(genre, 1)).data?.insertId;
          const audioGenreRel = (await getAudioGenreRelation(audioId, genreId))
            .data;
          if (audioGenreRel.length < 1) {
            await insertAudioGenreRelations(audioId, genreId, index + 1);
          }
        });
      }

      await insertAudioAlbumRelation(audioId, albumId, index + 1);
    }

    if (albumCover.upload) {
      const imageId = (await insertAlbumImage(2, albumCover.id, albumCover.rgb))
        .data.insertId;
      await insertImageAlbumRelation(imageId, albumId);
    }

    console.log(artistName, albumTitle);

    res.send({
      status: 200,
      albumId: albumId,
      data: req.body,
      message: "Album uploaded.",
    });
  } else {
    console.log("Album already uploaded:", artistName, albumId);

    res.send({
      status: 200,
      data: req.body,
      albumId: albumId,
      message: "Album already uploaded.",
    });
  }
});

async function getArtistImageByName(imageId) {
  const query = `
  SELECT artistimage_b.id
  FROM artistimage_b, image_artist_b, artist
  WHERE artistimage_b.id = image_artist_b.image_id
  AND image_artist_b.artist_id = artist.id
  AND artistimage_b.image_id = "${imageId}"
  ;`;

  return await resolveQuery(query);
}

async function getArtistImageByArtistId(artistId) {
  const query = `
  SELECT artistimage_b.id
  FROM artistimage_b, image_artist_b, artist
  WHERE artistimage_b.id = image_artist_b.image_id
  AND image_artist_b.artist_id = artist.id
  AND artist.id = ${artistId}
  ;`;

  return await resolveQuery(query);
}

async function insertGenre(genre, deleted = 0) {
  const query = `
  INSERT INTO genre(name, deleted)
  VALUES("${escapeMySQLString(genre)}",${deleted})
  ;`;

  return await resolveQuery(query);
}

async function getAudioGenreRelation(audioId, genreId) {
  const query = `
  SELECT * FROM audio_genre
  WHERE audio_id = ${audioId}
  AND genre_id = ${genreId}
  ;`;

  return await resolveQuery(query);
}

async function getAudioId(artistId, audioTitle) {
  const query = `
  SELECT audio.id
  FROM audio, artist, audio_artist
  WHERE audio.id = audio_artist.audio_id
  AND audio_artist.artist_id = artist.id
  AND artist.id = ${artistId}
  AND audio.title COLLATE utf8mb4_0900_ai_ci = 
  "${escapeMySQLString(audioTitle)}"
  ;`;

  return await resolveQuery(query);
}

async function insertAlbum(title, releaseDate, mbid) {
  const { day, month, year } = releaseDate;
  var params = "title";
  var values = `"${escapeMySQLString(title)}"`;

  if (day != null) {
    params += ", release_day";
    values += `, ${day}`;
  }
  if (month != null) {
    params += ", release_month";
    values += `, ${month}`;
  }
  if (year != null) {
    params += ", release_year";
    values += `, ${year}`;
  }
  if (mbid != null && mbid !== "") {
    params += `, last_fm_mbid`;
    values += `, "${mbid}"`;
  }

  const query = `
  INSERT INTO album(${params}) 
  VALUES(${values})
  ;`;

  return await resolveQuery(query);
}

async function insertAudioAlbumRelation(audioId, albumId, audioPosition) {
  const query = `
  INSERT INTO audio_album(audio_id, album_id, audio_position) 
  VALUES(${audioId}, ${albumId}, ${audioPosition})
  ;`;

  return await resolveQuery(query);
}

async function insertPhantomAudioData(title, duration, mbid, videoId) {
  var params = "title";
  var values = `"${escapeMySQLString(title)}"`;

  if (!Number.isNaN(Number(duration))) {
    params += ", duration";
    values += `, ${duration}`;
  }
  if (mbid) {
    params += ", last_fm_mbid";
    values += `, "${mbid}"`;
  }
  if (videoId) {
    params += ", youtube_video_id";
    values += `, "${videoId}"`;
  }

  const query = `
  INSERT INTO audio(${params}) 
  VALUES(${values})
  ;`;

  return await resolveQuery(query);
}

async function insertAlbumImage(domainId, imageId, rgb) {
  const { r, g, b } = rgb;

  const query = `
  INSERT INTO albumimage(domain_id, image_id, r, g, b) 
  VALUES(${domainId}, "${imageId}", ${r}, ${g}, ${b})
  ;`;

  return await resolveQuery(query);
}

async function insertImageAlbumRelation(imageId, albumId) {
  const query = `
  INSERT INTO image_album(image_id, album_id) 
  VALUES(${imageId}, ${albumId})
  ;`;

  return await resolveQuery(query);
}

require("dotenv/config");

router.get("/getLastFmApiKey", (req, res) => {
  res.send(process.env.LASTFM_API_KEY);
});

router.get("/getYoutubeApiKey", (req, res) => {
  res.send(process.env.YOUTUBE_API_KEY);
});

router.post("/insertNewTrack", async (req, res) => {
  const { artistId, trackTitle, duration, genres, mbid, videoId } = req.body;

  var trackId = (await getAudioId(artistId, trackTitle)).data[0]?.id;
  if (trackId === undefined) {
    trackId = (
      await insertPhantomAudioData(trackTitle, duration, mbid, videoId)
    ).data.insertId;
    await insertAudioLanguageRelation(trackId, 1);
    await insertAudioArtistRelation(trackId, artistId, 1);

    genres?.forEach(async (genre, index) => {
      const genreId =
        (await findGenre(genre)).data[0]?.id ||
        (await insertGenre(genre, 1)).data?.insertId;
      const audioGenreRel = (await getAudioGenreRelation(trackId, genreId))
        .data;
      if (audioGenreRel?.length < 1) {
        await insertAudioGenreRelations(trackId, genreId, index + 1);
      }
    });
  }
  res.status(200).send({ request: req.body, response: trackId });
});

router.post("/compareGenres", async (req, res) => {
  const genres = req.body;
  console.log(genres);
  for (const genre of genres) {
    console.log(genre);
    await compareGenres(genre);
  }

  res.status(200).send({ response: "Done." });
});

async function compareGenres(genre) {
  const query = `UPDATE genre SET deleted = 0 WHERE name COLLATE utf8mb4_0900_ai_ci = "${genre}";`;

  return resolveQuery(query);
}

router.post("/getAudiosForUpdate", async function (req, res) {
  const result = await getAudiosForUpdate(req.body);

  res.status(200).send(result.data);
});

async function getAudiosForUpdate({ lastAudioId = 0 }) {
  const query = `
  SELECT *
  FROM ( 
    SELECT audio.id AS audio_id, audio.title AS audio_title, artist.name AS artist_name
    FROM audio
    LEFT JOIN audio_artist
    ON audio.id = audio_artist.audio_id
    LEFT JOIN artist
    ON audio_artist.artist_id = artist.id
    WHERE audio.id > 800 AND audio.id < 59574
    ORDER BY audio.id, audio_artist.artist_position
  ) AS audio_artist_joined
  GROUP BY audio_artist_joined.audio_id
  ;`;

  return resolveQuery(query);
}

router.patch("/updateTrack", async function (req, res) {
  await updateTrack(req.body);
  console.log(req.body);

  res.status(200).send(req.body);
});

async function updateTrack({ audioId, videoId, mbid }) {
  const fieldsArr = [];
  if (videoId !== undefined) {
    fieldsArr.push(`youtube_video_id = "${videoId}"`);
  }
  if (mbid !== undefined) {
    fieldsArr.push(`last_fm_mbid = "${mbid}"`);
  }
  const fields = fieldsArr.join(", ");

  const query = `
  UPDATE audio SET ${fields} WHERE audio.id = ${audioId}
  ;`;

  return resolveQuery(query);
}

module.exports = router;
