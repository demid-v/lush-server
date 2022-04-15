const router = require("express").Router();
const { resolveQuery } = require("../general.js");

router.post("/genresData", async function (req, res) {
  console.log("Body:", req.body);

  const genreName = req.body.genreName;
  const result = await getGenres(genreName);
  const status = result.error || 200;
  const genresData = {
    status: status,
    genres: result.data,
  };

  res.send(genresData);
});

async function getGenres(genreName) {
  // const query = `
  // SELECT genre.id, genre.name, count(audio.id) AS audios_count
  // FROM genre

  // LEFT JOIN audio_genre
  // ON genre.id = audio_genre.genre_id
  // LEFT JOIN audio
  // ON audio.id = audio_genre.audio_id

  // GROUP BY genre.id
  // ORDER BY genre.name
  // ;`;

  var whereGenre = "";

  if (genreName) {
    genreName = genreName
      .replace("\\", "\\\\\\\\")
      .replace("'", "\\'")
      .replace('"', '\\"')
      .replace("%", "\\%");
    // Need to fix character escaping
    // console.log(artistName);

    whereGenre = `
    WHERE genre.name COLLATE utf8mb4_0900_ai_ci LIKE "%${genreName}%"
    `;
  }

  const query = `
  SELECT genre.id AS genre_id, genre.name AS genre_name
  FROM genre
  ${whereGenre}
  ORDER BY genre_name
  ;`;

  return await resolveQuery(query);
}

module.exports = router;
