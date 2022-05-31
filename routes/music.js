const router = require("express").Router();

const {
  resolveQuery,
  constructWhereClause,
  findGenre,
  deleteAudioGenreRelations,
  escapeMySQLString,
  insertArtistImage,
  insertImageArtistRelation,
  getAlbum,
} = require("../general.js");

router.get("/tracks", async function (req, res) {
  console.log("Body:", req.query);

  const result = await getTracks(req.query);

  const tracks = {
    status: result.error || 200,
    tracks: result.data,
  };

  res.send(tracks);
});

async function getTracks({ search, genres, shuffle, limit, offset }) {
  if (search == null) {
    search = "";
  }

  const query = `
  CALL get_tracks(${limit}, ${offset}, "${search}")
  ;`;

  return resolveQuery(query);
}

router.get("/artistTracks", async function (req, res) {
  console.log("Body:", req.query);

  const result = await getArtistTracks(req.query);

  const tracks = {
    status: result.error || 200,
    tracks: result.data,
  };

  res.send(tracks);
});

async function getArtistTracks({
  artistId,
  search,
  genres,
  shuffle,
  limit,
  offset,
}) {
  if (search == null) {
    search = "";
  }

  const query = `
  CALL get_tracks_for_artist(${artistId}, ${limit}, ${offset}, "${search}")
  ;`;

  return resolveQuery(query);
}

router.patch("/editAudio", async function (req, res) {
  console.log("Body:", req.body);

  const dataRequest = req.body.dataRequest;
  const { audioId, title, artists, genres } = dataRequest;

  await editAudioTitle(audioId, title);

  await deleteAudioArtistRelations(audioId);
  artists.forEach(async (artistId, index) => {
    if (artistId !== undefined) {
      await insertTrackArtistRelation(audioId, artistId, index + 1);
    }
  });

  await deleteAudioGenreRelations(audioId);
  genres.forEach(async (genreId, index) => {
    if (genreId !== undefined) {
      await insertTrackGenreRelations(audioId, genreId, index + 1);
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

async function insertTrackArtistRelation(trackId, artistId, artistPosition) {
  const query = `
  INSERT INTO track_artist_rel(track_id, artist_id, artist_position) 
  VALUES(${trackId}, ${artistId}, ${artistPosition})
  ;`;

  return resolveQuery(query);
}

async function insertTrackGenreRelations(trackId, genreId, genrePosition) {
  const query = `
  INSERT INTO track_genre_rel(track_id, genre_id, genre_position) 
  VALUES(${trackId}, ${genreId}, ${genrePosition})
  ;`;

  return resolveQuery(query);
}

async function insertTrackLanguageRelation(trackId, languageId) {
  const query = `
  INSERT INTO track_language_rel(track_id, language_id) 
  VALUES(${trackId}, ${languageId})
  ;`;

  return await resolveQuery(query);
}

router.get("/randomAudio", async function (req, res, _next) {
  // console.log("Body:", req.body);

  const dataRequest = { shuffle: true, limit: 3 };
  const result = await getTracks(dataRequest);

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
      var trackId = (await getTrackId(artistId, track.title)).data[0]?.id;
      if (trackId === undefined) {
        trackId = (
          await insertTrackData(
            track.title,
            track.duration,
            track.mbid,
            track.videoId
          )
        ).data.insertId;
        await insertTrackLanguageRelation(trackId, 1);
        await insertTrackArtistRelation(trackId, artistId, 1);
      }

      if (track.genres?.length > 0) {
        track.genres.forEach(async (genre, index) => {
          const genreId =
            (await findGenre(genre)).data[0]?.id ||
            (await insertGenre(genre, 1)).data?.insertId;
          const audioGenreRel = (await getTrackGenreRelation(trackId, genreId))
            .data;
          if (audioGenreRel?.length < 1) {
            await insertTrackGenreRelations(trackId, genreId, index + 1);
          }
        });
      } else if (genres?.length > 0) {
        genres.forEach(async (genre, index) => {
          const genreId =
            (await findGenre(genre)).data[0]?.id ||
            (await insertGenre(genre, 1)).data?.insertId;
          const audioGenreRel = (await getTrackGenreRelation(trackId, genreId))
            .data;
          if (audioGenreRel.length < 1) {
            await insertTrackGenreRelations(trackId, genreId, index + 1);
          }
        });
      }

      await insertTrackAlbumRelation(trackId, albumId, index + 1);
    }

    if (albumCover.upload) {
      const imageId = (await insertAlbumImage(2, albumCover.id, albumCover.rgb))
        .data.insertId;
      await insertAlbumImageRelation(imageId, albumId);
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
  SELECT artist_image.id
  FROM artist_image, artist_image_rel, artist
  WHERE artist_image.id = artist_image_rel.image_id
  AND artist_image_rel.artist_id = artist.id
  AND artist_image.image_id = "${imageId}"
  ;`;

  return resolveQuery(query);
}

async function getArtistImageByArtistId(artistId) {
  const query = `
  SELECT artist_image.id
  FROM artist_image, artist_image_rel, artist
  WHERE artist_image.id = artist_image_rel.image_id
  AND artist_image_rel.artist_id = artist.id
  AND artist.id = ${artistId}
  ;`;

  return resolveQuery(query);
}

async function insertGenre(genre, deleted = 0) {
  const query = `
  INSERT INTO genre(name, deleted)
  VALUES("${escapeMySQLString(genre)}",${deleted})
  ;`;

  return await resolveQuery(query);
}

async function getTrackGenreRelation(trackId, genreId) {
  const query = `
  SELECT * FROM track_genre_rel
  WHERE track_id = ${trackId}
  AND genre_id = ${genreId}
  ;`;

  return await resolveQuery(query);
}

async function getTrackId(artistId, trackTitle) {
  const query = `
  SELECT track.id
  FROM track, artist, track_artist_rel
  WHERE track.id = track_artist_rel.track_id
  AND track_artist_rel.artist_id = artist.id
  AND artist.id = ${artistId}
  AND track.title COLLATE utf8mb4_0900_ai_ci = 
  "${escapeMySQLString(trackTitle)}"
  ;`;

  return resolveQuery(query);
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

async function insertTrackAlbumRelation(trackId, albumId, trackPosition) {
  const query = `
  INSERT INTO track_album_rel(track_id, album_id, track_position) 
  VALUES(${trackId}, ${albumId}, ${trackPosition})
  ;`;

  return await resolveQuery(query);
}

async function insertTrackData(title, duration, mbid, videoId) {
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
  INSERT INTO track(${params}) 
  VALUES(${values})
  ;`;

  return await resolveQuery(query);
}

async function insertAlbumImage(domainId, imageId, rgb) {
  const { r, g, b } = rgb;

  const query = `
  INSERT INTO album_image(domain_id, image_id, r, g, b) 
  VALUES(${domainId}, "${imageId}", ${r}, ${g}, ${b})
  ;`;

  return await resolveQuery(query);
}

async function insertAlbumImageRelation(imageId, albumId) {
  const query = `
  INSERT INTO album_image_rel(image_id, album_id) 
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

  var trackId = (await getTrackId(artistId, trackTitle)).data[0]?.id;
  if (trackId === undefined) {
    trackId = (await insertTrackData(trackTitle, duration, mbid, videoId)).data
      .insertId;
    await insertTrackLanguageRelation(trackId, 1);
    await insertTrackArtistRelation(trackId, artistId, 1);

    genres?.forEach(async (genre, index) => {
      const genreId =
        (await findGenre(genre)).data[0]?.id ||
        (await insertGenre(genre, 1)).data?.insertId;
      const trackGenreRel = (await getTrackGenreRelation(trackId, genreId))
        .data;
      if (trackGenreRel?.length < 1) {
        await insertTrackGenreRelations(trackId, genreId, index + 1);
      }
    });
  }
  res.status(200).send({ request: req.body, response: trackId });
});

module.exports = router;
