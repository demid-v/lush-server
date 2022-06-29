const connection = require("./database.js");

async function resolveQuery(query, values) {
  var err, res;

  await Promise.resolve(executeQuery(query, values))
    .then(
      (result) => (res = result),
      (error) => (err = error)
    )
    .catch((error) => {
      err = error;
      console.log("Error:", error);
    });

  return { error: err, data: res };
}

function executeQuery(query, values) {
  return new Promise((resolve, reject) => {
    connection.query(query, values, function (error, result) {
      if (error) {
        console.error("Error occured while executing a query.", error);
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

const artistsGroupBy = function (xs, key) {
  return xs.reduce(function (rv, x) {
    if (!rv.has(x[key])) {
      rv.set(x[key], { albums: {}, genres: {} });
    }

    rv.get(x[key]).id = x.artist_id;
    rv.get(x[key]).name = x.artist_name;
    rv.get(x[key]).image_id = x.artist_image_id;
    rv.get(x[key]).domain_id = x.artist_domain_id;
    rv.get(x[key]).domain_name = x.artist_domain_name;
    rv.get(x[key]).r = x.r;
    rv.get(x[key]).g = x.g;
    rv.get(x[key]).b = x.b;

    if (x.genre_id) {
      rv.get(x[key]).genres[x.genre_id] = {
        id: x.genre_id,
        name: x.genre_name,
        position: x.genre_position,
      };
    }

    if (x.album_id) {
      rv.get(x[key]).albums[x.album_id] = {
        id: x.album_id,
        title: x.album_title,
        domain_name: x.album_domain_name,
        domain_id: x.album_domain_id,
        image_id: x.album_image_id,
        audio_count: x.album_audio_count,
        release_day: x.album_release_day,
        release_month: x.album_release_month,
        release_year: x.album_release_year,
      };
    }

    return rv;
  }, new Map());
};

async function insertArtist({ artistName, mbid }) {
  var fields = "name";
  var values = `"${artistName}"`;
  if (mbid) {
    fields += ", last_fm_mbid";
    values += `, "${mbid}"`;
  }

  const query = `
  INSERT INTO artist(${fields})
  VALUES(${values})
  ;`;

  return resolveQuery(query);
}

function constructWhereClause(whereClauses, conj = "AND", is_part) {
  if (whereClauses.length < 1) return "";

  const whereClausesJoined = whereClauses.join(` ${conj} `);

  if (is_part) return `(${whereClausesJoined})`;
  else return "WHERE " + whereClausesJoined;
}

function trimExtension(filename) {
  return filename.replace(/\.[^\/.]+$/, "");
}

function escapeMySQLString(string) {
  return string.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function setGenre(artistId, genreId, genrePosition) {
  const query = `
  CALL INSERT_AUDIO_TAG_RELATIONS(${artistId}, ${genreId}, ${genrePosition});
  `;

  return await resolveQuery(query);
}

async function findGenre(genre) {
  // const whereClauses = [];
  // genreAliases.forEach((genreAliase) =>
  //   whereClauses.push(`name COLLATE utf8mb4_0900_ai_ci LIKE "%${genreAliase}%"`)
  // );
  // const whereClause = constructWhereClause(whereClauses, "OR");

  const query = `
  SELECT id
  FROM genre
  WHERE name COLLATE utf8mb4_0900_ai_ci = "${escapeMySQLString(genre)}"
  `;

  return await resolveQuery(query);
}

async function deleteAudioGenreRelations(audioId) {
  const query = `
  DELETE FROM audio_genre
  WHERE audio_id = ${audioId}
  ;`;

  return await resolveQuery(query);
}

async function getAlbum(artistId, albumTitle) {
  const whereClauses = [];
  if (artistId) whereClauses.push(`artist.id = ${artistId}`);
  if (albumTitle)
    whereClauses.push(`album.title = "${escapeMySQLString(albumTitle)}"`);
  const whereClause = constructWhereClause(whereClauses);

  const query = `
  SELECT album.id
  FROM album
  INNER JOIN track_album_rel
  ON track_album_rel.album_id = album.id
	LEFT JOIN track
	ON track_album_rel.track_id = track.id
  LEFT JOIN track_artist_rel
  ON track.id = track_artist_rel.track_id
  LEFT JOIN artist
  ON track_artist_rel.artist_id = artist.id
  ${whereClause}`;

  return await resolveQuery(query);
}

async function getAlbums(artistId, albumTitle) {
  var artistWhereClause = "";
  var albumWhereClause = "";
  if (artistId) artistWhereClause = `AND artist.id = ${artistId}`;
  if (albumTitle)
    albumWhereClause = `AND album.title = "${escapeMySQLString(albumTitle)}"`;

  const query = `
  SELECT DISTINCT album.id AS album_id, album.title AS album_title, album.release_day AS album_release_day, 
  album.release_month AS album_release_month, album.release_year AS album_release_year,
  albumimage.domain_id AS album_image_domain_id, albumimage.image_id AS album_image_image_id, COUNT(audio.id) AS audio_count
  FROM album

  LEFT JOIN image_album
  ON album.id = image_album.album_id
  LEFT JOIN albumimage
  ON image_album.image_id = albumimage.id

  LEFT JOIN audio_album
  ON album.id = audio_album.album_id
  ${albumWhereClause}
  LEFT JOIN audio
  ON audio_album.audio_id = audio.id

  LEFT JOIN audio_artist
  ON audio.id = audio_artist.audio_id
  LEFT JOIN artist
  ON audio_artist.artist_id = artist.id
  ${artistWhereClause}

  GROUP BY album.id
  ;`;

  return await resolveQuery(query);
}

async function insertArtistImage(domainId, imageId, rgb) {
  const { r, g, b } = rgb;

  const query = `
  INSERT INTO artist_image(domain_id, image_id, r, g, b) 
  VALUES(${domainId}, "${imageId}", ${r}, ${g}, ${b})
  ;`;

  return resolveQuery(query);
}

async function insertImageArtistRelation(imageId, artistId, isCover) {
  if (isCover == null) isCover = 1;

  const query = `
  INSERT INTO artist_image_rel(image_id, artist_id, is_cover) 
  VALUES(${imageId}, ${artistId}, ${isCover})
  ;`;

  return resolveQuery(query);
}

module.exports = {
  resolveQuery,
  artistsGroupBy,
  insertArtist,
  constructWhereClause,
  trimExtension,
  escapeMySQLString,
  setGenre,
  findGenre,
  deleteAudioGenreRelations,
  getAlbums,
  getAlbum,
  insertArtistImage,
  insertImageArtistRelation,
};
