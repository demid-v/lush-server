const { constructWhereClause, resolveQuery } = require("../general");

const router = require("express").Router();

router.get("/albums", async (req, res) => {
  const result = await getAlbums(req.query);

  const albums = {
    status: result.error || 200,
    albums: result.data,
  };

  res.status(200).send(albums);
});

async function getAlbums({ albumId, search, shuffle, limit, offset }) {
  if (search == null) {
    search = "";
  }

  const query = `
  CALL get_albums(${limit}, ${offset}, "${search}")
  ;`;

  return resolveQuery(query);
}

router.get("/artistAlbums", async function (req, res) {
  console.log("Body:", req.query);

  const result = await getArtistAlbums(req.query.artistId);

  const albums = {
    status: result.error || 200,
    albums: result.data,
  };

  res.send(albums);
});

async function getArtistAlbums(artistId) {
  const query = `
  CALL get_albums_for_artist(${artistId})
  ;`;

  return resolveQuery(query);
}

module.exports = router;
