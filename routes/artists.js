const router = require("express").Router();
const {
  resolveQuery,
  constructWhereClause,
  insertArtist,
  artistsGroupBy,
  setGenre,
  escapeMySQLString,
  getAlbums,
  insertArtistImage,
  insertImageArtistRelation,
} = require("../general.js");

router.get("/artists", async (req, res) => {
  const result = await getArtists(req.query);

  const artists = {
    status: result.error || 200,
    artists: result.data,
  };

  res.send(artists);
});

async function getArtists({ artistId, search, shuffle, limit, offset }) {
  if (search == null) {
    search = "";
  }

  const query = `
  CALL get_artists(${limit}, ${offset}, "${search}")
  `;

  return resolveQuery(query);
}

router.get("/artist", async (req, res) => {
  const result = await getArtist(req.query.artistId);

  const artist = {
    status: result.error || 200,
    artist: result.data[0][0],
  };

  res.send(artist);
});

async function getArtist(artistId) {
  const query = `
  CALL get_artist(${artistId})
  ;`;

  return resolveQuery(query);
}

router.post("/submitArtist", async function (req, res) {
  const artistMetadata = JSON.parse(req.body.artistMetadata);
  var artistId = artistMetadata.artistId;
  const artistName = artistMetadata.artistName?.replace('"', '\\"'); // Need to improve character escaping
  const image = req.files?.image;
  const genres = artistMetadata.genres;
  const rgb = artistMetadata.rgb;

  if (artistId) {
    await editArtist(artistId, artistName);
  } else {
    artistId = (await insertArtist(artistName)).data.insertId;
  }

  if (image) {
    // const blobId = (await insertArtistImageBlob(image.data)).data.insertId;
    const googleDriveImageId = await uploadImageToGoogleDrive(
      "artists_images",
      artistName,
      image
    );
    const imageId = (await insertArtistImage(1, googleDriveImageId, rgb)).data
      .insertId;
    await insertImageArtistRelation(imageId, artistId);
  }

  await deleteAudioGenreRelations(artistId);
  genres.forEach(async (genreId, index) => {
    await setGenre(artistId, genreId, index + 1);
  });

  res.send({
    status: 200,
    message: "File uploaded.",
    artistId: artistId,
    artistName: artistName,
  });
});

router.post("/insertNewArtist", async function (req, res) {
  console.log(req.body);

  const artistId =
    (await getArtistByName(req.body.artistName)).data[0]?.id ||
    (await insertArtist(req.body)).data.insertId;

  res.status(200).send({ request: req.body, response: artistId });
});

async function getArtistByName(artistName) {
  const query = `
  SELECT id
  FROM artist
  WHERE artist.name COLLATE utf8mb4_0900_ai_ci = 
  "${escapeMySQLString(artistName)}"
  ;`;

  return resolveQuery(query);
}

async function deleteAudioGenreRelations(artistId) {
  const query = `
  CALL delete_audio_genre_relations(${artistId})
  ;`;

  return await resolveQuery(query);
}

async function editArtist(artistId, artistName) {
  const query = `
  UPDATE artist
  SET name = "${artistName}"
  WHERE id = ${artistId}
  ;`;

  return await resolveQuery(query);
}

router.delete("/deleteArtist", async function (req, res) {
  console.log("Body:", req.body);

  const artistId = req.body.artistId,
    result = await deleteArtist(artistId),
    audiosData = {
      status: result.error || 200,
      audios: result.data,
    };

  res.send(audiosData);
});

async function deleteArtist(artistId) {
  const query = `
  UPDATE artist
  SET deleted = 1
  WHERE id = ${artistId}
  ;`;

  return await resolveQuery(query);
}

router.post("/uploadRGB", async function (req, res) {
  const { r, g, b } = req.body.rgb;
  const id = req.body.id;
  await insertRGB(id, r, g, b);

  res.send({ id: id, rgb: { r, g, b } });
});

async function insertRGB(id, r, g, b) {
  const query = `
  UPDATE artistimage_b
  SET r = ${r}, g = ${g}, b = ${b}
  WHERE id = ${id}
  ;`;

  return await resolveQuery(query);
}

router.patch("/updateArtistMbid", async function (req, res) {
  await updateArtistMbid(req.body);
  console.log(req.body);

  res.status(200).send(req.body);
});

async function updateArtistMbid({ artistId, mbid }) {
  const query = `
  UPDATE artist SET last_fm_mbid = "${mbid}" WHERE id = ${artistId};`;

  return resolveQuery(query);
}

router.post("/artistsMbid", async function (req, res) {
  const artists = await getArtistsMbid();

  res.send(artists);
});

async function getArtistsMbid() {
  const query = `
  SELECT id, name
  FROM artist
  WHERE deleted = 0
  AND id > (
    SELECT id
    FROM artist
    WHERE has_last_fm_mbid = 1
    ORDER BY id DESC
    LIMIT 1
  )
  ;`;

  return await resolveQuery(query);
}

module.exports = router;
