const { constructWhereClause, resolveQuery } = require("../general");

const router = require("express").Router();

router.post("/albumsData", async (req, res) => {
  const result = await getAlbums(req.body);

  const status = result.error || 200;
  const albums = result.data;
  const albumsData = {
    status: status,
    albums: albums,
  };

  res.status(200).send(albumsData);
});

router.post("/albumsDataForArtist", async (req, res) => {
  const result = await getAlbumsForArtist(req.body.artistId);

  const status = result.error || 200;
  const albums = result.data;
  const albumsData = {
    status: status,
    albums: albums,
  };

  res.status(200).send(albumsData);
});

async function getAlbums({ albumId, search, shuffle, limit, offset }) {
  var albumIdWhereClause = "",
    queryWhereClauses = [],
    subquery = "",
    subqueryWhereClauses = [],
    searchQuery = "";

  const whereClauseDeleted = "album.deleted = 0";
  queryWhereClauses.push(whereClauseDeleted);
  subqueryWhereClauses.push(whereClauseDeleted);

  if (search) {
    searchQuery = `
    (
      album.title COLLATE utf8mb4_0900_ai_ci LIKE "%${search}%"
    )`;

    queryWhereClauses.push(searchQuery);
    subqueryWhereClauses.push(searchQuery);
  }

  var orderBy;
  if (shuffle) {
    orderBy = "RAND()";
  } else if (albumId) {
    albumIdWhereClause = `
    album.id = ${albumId}
    `;

    queryWhereClauses.push(albumIdWhereClause);
    subqueryWhereClauses.push(albumIdWhereClause);

    orderBy = "album.id DESC";
  } else {
    const subqueryWhereClause = constructWhereClause(subqueryWhereClauses);

    subquery = `
    album.id <= 
    (
      SELECT album.id 
      FROM album 
      ${subqueryWhereClause}
      ORDER BY album.id DESC
      LIMIT 1 OFFSET ${offset}
    )`;

    queryWhereClauses.push(subquery);

    orderBy = "album.id DESC";
  }

  const queryWhereClause = constructWhereClause(queryWhereClauses);

  const query = `
  SELECT album.id AS album_id, album.title AS album_title, 
  albumimage.image_id AS album_image_id, albumimage.r, albumimage.g, albumimage.b, 
  domain.id AS album_domain_id, domain.name AS album_domain_name, genre.id AS genre_id, genre.name AS genre_name
  FROM (
    SELECT album.id, title
    FROM album
    ${queryWhereClause}
    ORDER BY ${orderBy}
    LIMIT ${limit}
    ) album
 
  LEFT JOIN image_album
  ON album.id = image_album.album_id
  AND is_cover = 1
  LEFT JOIN albumimage
  ON albumimage.id = image_album.image_id
  LEFT JOIN domain
  ON albumimage.domain_id = domain.id
  
  LEFT JOIN audio_album
  ON album.id = audio_album.album_id
  LEFT JOIN audio 
  ON audio_album.audio_id = audio.id
  
  LEFT JOIN audio_genre 
  ON audio.id = audio_genre.audio_id
  LEFT JOIN genre 
  ON audio_genre.genre_id = genre.id AND genre.deleted = 0
  ;`;

  // console.log(query);

  return await resolveQuery(query);
}

router.post("/albumsForAlbums", async (req, res) => {
  const result = await getAlbumsForAlbums(req.body);

  const status = result.error || 200;
  const albums = result.data[0];
  const albumsData = {
    status: status,
    albums: albums,
  };

  res.status(200).send(albumsData);
});

async function getAlbumsForAlbums() {
  const query = `CALL get_albums_for_albums()`;

  return resolveQuery(query);
}

async function getAlbumsForArtist(artistId) {
  const query = `CALL get_albums_for_artist(${artistId});`;

  return resolveQuery(query);
}

router.post("/getAlbumsForUpdate", async function (req, res) {
  const result = await getAlbumsForUpdate(req.body);

  res.status(200).send(result.data);
});

async function getAlbumsForUpdate({ lastAlbumId = 0 }) {
  const query = `
  SELECT *
  FROM ( 
    SELECT album.id AS album_id, album.title AS album_title, artist.name AS artist_name
    FROM album
    LEFT JOIN audio_album
    ON album.id = audio_album.album_id
    LEFT JOIN audio
    ON audio_album.audio_id = audio.id
    LEFT JOIN audio_artist
    ON audio.id = audio_artist.audio_id
    LEFT JOIN artist
    ON audio_artist.artist_id = artist.id
    WHERE album.id > (
      SELECT album.id 
      FROM album 
      WHERE album.has_last_fm_mbid = 1
      ORDER BY album.id DESC
      LIMIT 1
    )
    ORDER BY album.id, audio_artist.artist_position
  ) AS album_artist_joined
  GROUP BY album_artist_joined.album_id
  ;`;

  return resolveQuery(query);
}

router.patch("/updateAlbum", async function (req, res) {
  await updateAlbum(req.body);
  console.log(req.body);

  res.status(200).send(req.body);
});

async function updateAlbum({ albumId, mbid }) {
  const query = `UPDATE album SET last_fm_mbid = "${mbid}" WHERE album.id = ${albumId};`;

  return resolveQuery(query);
}

module.exports = router;
