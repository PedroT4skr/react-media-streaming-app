const express = require('express');
const router = express.Router();
const axios = require('axios');

// User provided API Key for TheIntroDB
const INTRODB_KEY = process.env.INTRODB_API_KEY || 'theintrodb:user_3EprXCGFlOjdF9v4TTilYRkDbpK:SyQFXFOkOyBxjqZbqjwjnj9ZmAC5GCdwAvg1nOmL6Xo';

router.get('/:tmdb_id', async (req, res) => {
  const { tmdb_id } = req.params;
  const { type, season, episode, duration_ms } = req.query;

    const defaultMock = {
      introStart: -1,
      introEnd: -1,
      creditsOffset: 85 
    };

  try {
    let introUrl = `https://api.theintrodb.org/v3/media?tmdb_id=${tmdb_id}`;
    if (type === 'tv') {
      introUrl += `&season=${season}&episode=${episode}`;
    }
    if (duration_ms && duration_ms !== 'NaN') {
      introUrl += `&duration_ms=${duration_ms}`;
    }

    const introRes = await axios.get(introUrl, {
      headers: { Authorization: `Bearer ${INTRODB_KEY}` },
      timeout: 5000
    });

    const data = introRes.data;
    
    let introStart = defaultMock.introStart;
    let introEnd = defaultMock.introEnd;
    let creditsOffset = defaultMock.creditsOffset;

    let recapStart = -1;
    let recapEnd = -1;

    if (data.intro && data.intro.length > 0) {
      introStart = data.intro[0].start_ms !== null ? data.intro[0].start_ms / 1000 : 0;
      introEnd = data.intro[0].end_ms !== null ? data.intro[0].end_ms / 1000 : 0;
    }

    if (data.recap && data.recap.length > 0) {
      recapStart = data.recap[0].start_ms !== null ? data.recap[0].start_ms / 1000 : 0;
      recapEnd = data.recap[0].end_ms !== null ? data.recap[0].end_ms / 1000 : 0;
    }

    if (data.credits && data.credits.length > 0) {
      const creditStartMs = data.credits[0].start_ms;
      if (creditStartMs !== null && duration_ms) {
        creditsOffset = (parseInt(duration_ms) - creditStartMs) / 1000;
      }
    }

    return res.json({ introStart, introEnd, recapStart, recapEnd, creditsOffset });

  } catch (err) {
    return res.json(defaultMock);
  }
});

module.exports = router;
