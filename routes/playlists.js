const router = require("express").Router();
const { resolveQuery, constructWhereClause } = require("../general.js");

router.post("/playlistsData", async function (req, res) {
  console.log("Body:", req.body);

  const dataRequest = req.body;

  const result = await getPlaylists(dataRequest);
  const playlists = result.data?.map((playlist) => ({ ...playlist })) || [];
  const status = result.error || 200;
  const playlistsData = {
    status: status,
    playlists: playlists,
  };

  res.send(playlistsData);
});

async function getPlaylists({ playlistId, search, limit, offset }) {
  var playlistIdWhereClause = "";
  var queryWhereClauses = [];
  var subquery = "";
  var subqueryWhereClauses = [];
  var searchQuery = "";

  const whereClauseDeleted = "playlist.deleted = 0";
  queryWhereClauses.push(whereClauseDeleted);
  subqueryWhereClauses.push(whereClauseDeleted);

  if (search) {
    searchQuery = `
      (
        playlist.name COLLATE utf8mb4_0900_ai_ci LIKE "%${search}%"
      )`;

    queryWhereClauses.push(searchQuery);
    subqueryWhereClauses.push(searchQuery);
  }

  if (playlistId) {
    playlistIdWhereClause = `
      playlist.id = ${playlistId}
      `;

    queryWhereClauses.push(playlistIdWhereClause);
    subqueryWhereClauses.push(playlistIdWhereClause);
  } else {
    const subqueryWhereClause = constructWhereClause(subqueryWhereClauses);

    subquery = `
      playlist.id <= 
      (
        SELECT playlist.id 
        FROM playlist 
        ${subqueryWhereClause}
        ORDER BY playlist.id DESC
        LIMIT 1 OFFSET ${offset}
      )`;

    queryWhereClauses.push(subquery);
  }

  const queryWhereClause = constructWhereClause(queryWhereClauses);

  const query = `
    SELECT playlist.id AS playlist_id, name, blob_id
    FROM (
      SELECT playlist.id, name
      FROM playlist
      ${queryWhereClause}
      ORDER BY playlist.id DESC
      LIMIT ${limit}
      )
    playlist

    LEFT JOIN image_playlist
    ON playlist.id = image_playlist.playlist_id
    LEFT JOIN playlistimage
    ON playlistimage.id = image_playlist.image_id
    ;`;

  // console.log(query);

  return await resolveQuery(query);
}

router.post("/submitPlaylist", async function (req, res) {
  console.log("Body:", req.body);
  console.log("Body:", req.files);

  const playlistMetadata = JSON.parse(req.body.playlistMetadata);
  var playlistId = playlistMetadata.playlistId;
  // TODO: Improve character escaping
  const playlistName = playlistMetadata.playlistName.replace('"', '\\"');
  const image = req.files?.image;
  const audioIds = playlistMetadata.audioIds;

  if (playlistId) {
    await editPlaylist(playlistId, playlistName);
  } else {
    playlistId = (await insertPlaylist(playlistName)).data.insertId;
  }

  if (image) {
    console.log("Has image.");
    // const blobId = (await insertImageBlob(image.data)).data.insertId;
    // const imageId = await (await insertImageData(blobId)).data.insertId;
    // await insertImagePlaylist(imageId, playlistId);
  }

  await deleteAudioPlaylistRelations(playlistId);

  for (const [index, audioId] of audioIds.entries()) {
    await addAudioPlaylistRelation(audioId, playlistId, index + 1);
  }

  res.send({
    status: 200,
    message: "File uploaded.",
    playistId: playlistId,
    playistName: playlistName,
    audioIds: audioIds,
  });
});

async function deleteAudioPlaylistRelations(playlistId) {
  const query = `
  DELETE FROM audio_playlist
  WHERE playlist_id = ${playlistId}
  ;`;

  return await resolveQuery(query);
}

async function addAudioPlaylistRelation(audioId, playlistId, audioPosition) {
  const query = `
  INSERT INTO audio_playlist()
  VALUES( ${audioId}, ${playlistId}, ${audioPosition})
  ;`;

  return await resolveQuery(query);
}

async function editPlaylist(playlistId, playlistName) {
  const query = `
  UPDATE playlist
  SET name = "${playlistName}"
  WHERE id = ${playlistId}
  ;`;

  return await resolveQuery(query);
}

async function insertPlaylist(playlistName) {
  const query = `
  INSERT INTO playlist(name)
  VALUES("${playlistName}")
  ;`;

  return await resolveQuery(query);
}

router.delete("/deletePlaylist", async function (req, res) {
  console.log("Body:", req.body);

  const playlistId = req.body.playlistId;
  const result = await deletePlaylist(playlistId);
  const playlistsData = {
    status: result.error || 200,
    playlists: result.data,
  };

  res.send(playlistsData);
});

async function deletePlaylist(playlistId) {
  const query = `
  UPDATE playlist
  SET deleted = 1
  WHERE id = ${playlistId}
  ;`;

  return await resolveQuery(query);
}

module.exports = router;
