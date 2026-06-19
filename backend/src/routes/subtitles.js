const express = require('express');
const router = express.Router();
const axios = require('axios');
const { getMediaInfo } = require('../services/tmdb');

// Rota para listar legendas disponíveis
router.get('/list/:tmdb_id', async (req, res) => {
  try {
    const { tmdb_id } = req.params;
    const type = req.query.type === 'tv' ? 'series' : 'movie';
    const season = req.query.season;
    const episode = req.query.episode;

    const mediaInfo = await getMediaInfo(tmdb_id, req.query.type === 'tv' ? 'tv' : 'movie');
    const imdb_id = mediaInfo.imdb_id;

    if (!imdb_id) {
      return res.json([]);
    }

    let extra = [];
    if (req.query.filename) {
      extra.push(`filename=${encodeURIComponent(req.query.filename)}`);
    }
    const extraStr = extra.length > 0 ? `/${extra.join('%26')}` : '';

    // Novo Provider: OpenSubtitles v3 PRO com Auto-Adjustment e AI Translation
    const providerBase = 'https://opensubtitlesv3-pro.dexter21767.com/eyJsYW5ncyI6WyJwb3J0dWd1ZXNlLWJyIiwiZW5nbGlzaCJdLCJzb3VyY2UiOiJhbGwiLCJhaVRyYW5zbGF0ZWQiOnRydWUsImF1dG9BZGp1c3RtZW50Ijp0cnVlfQ==';
    
    let url = `${providerBase}/subtitles/${type}/${imdb_id}${extraStr}.json`;
    if (type === 'series' && req.query.season && req.query.episode) {
      url = `${providerBase}/subtitles/${type}/${imdb_id}:${req.query.season}:${req.query.episode}${extraStr}.json`;
    }

    const { data } = await axios.get(url);
    if (!data || !data.subtitles) return res.json([]);

    const subs = data.subtitles.map(s => ({
      id: s.id,
      url: s.url,
      lang: s.lang // ex: "por", "eng"
    }));

    // Limita a 5 legendas por idioma para não poluir demais, mas dar opções ao usuário
    const langCounts = {};
    const processedSubs = [];

    for (const sub of subs) {
      if (!langCounts[sub.lang]) langCounts[sub.lang] = 0;
      if (langCounts[sub.lang] < 5) {
        langCounts[sub.lang]++;
        processedSubs.push({
          id: sub.id,
          url: sub.url,
          lang: sub.lang,
          label: `${sub.lang} ${langCounts[sub.lang]}` // ex: "por 1", "por 2"
        });
      }
    }

    res.json(processedSubs);
  } catch (err) {
    console.error('[Subtitles] Error fetching list:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Rota para baixar e converter SRT para VTT on-the-fly de forma robusta
router.get('/proxy', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).send('No URL provided');

    const { data } = await axios.get(url, { responseType: 'text' });
    
    let vtt = data;
    if (!vtt.startsWith('WEBVTT')) {
      const srt = data.replace(/\r+/g, '');
      const blocks = srt.split('\n\n');
      vtt = 'WEBVTT\n\n';
      
      for (const block of blocks) {
        const lines = block.split('\n');
        const timeLineIndex = lines.findIndex(l => l.includes('-->'));
        
        if (timeLineIndex !== -1) {
          let timeLine = lines[timeLineIndex];
          // Normalizar timestamps para formato estrito WebVTT: HH:MM:SS.MMM
          timeLine = timeLine.replace(/(\d{1,2}:\d{2}:\d{2})[,.](\d{1,3})/g, (m, p1, p2) => {
            return p1.padStart(8, '0') + '.' + p2.padEnd(3, '0');
          });
          
          const textLines = lines.slice(timeLineIndex + 1);
          // Remover tags SSA/ASS {\an8} etc, que quebram o parser do Chrome
          let text = textLines.join('\n').replace(/\{[^}]+\}/g, '');
          
          vtt += timeLine + '\n' + text + '\n\n';
        }
      }
    }

    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(vtt);
  } catch (err) {
    console.error('[Subtitles] Proxy error:', err.message);
    res.status(500).send('Error proxying subtitle');
  }
});

module.exports = router;
