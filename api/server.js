// api/server.js - FINAL SCRAPERAPI METHOD

import axios from 'axios';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  // --- IMPORTANT: Paste your API Key from ScraperAPI here ---
  const API_KEY = '548f917d93879259cdfe070d47c5063d';
  
  const targetUrl = 'https://fit.gent/uurrooster/';
  const scraperApiUrl = `http://api.scraperapi.com?api_key=${API_KEY}&url=${encodeURIComponent(targetUrl)}`;

  try {
    // Make one simple request to ScraperAPI. It handles everything.
    const response = await axios.get(scraperApiUrl);
    const html = response.data;
    const $ = cheerio.load(html);

    // Our original, simple cheerio logic will now work because we have the real HTML
    const scrapedSchedule = {};
    const days = [];
    
    $('table.uurrooster thead th').each((i, el) => { if (i > 0) days.push($(el).text().trim()); });
    days.forEach(day => scrapedSchedule[day] = []);
    $('table.uurrooster tbody tr').each((rowIndex, rowEl) => {
        const time = $(rowEl).find('td').first().text().trim();
        $(rowEl).find('td').slice(1).each((colIndex, colEl) => {
            const day = days[colIndex];
            if (day) {
                const lessonLink = $(colEl).find('div.les-uurrooster a');
                if (lessonLink.length) {
                    scrapedSchedule[day].push({ time, name: lessonLink.text().trim(), url: `https://fit.gent${lessonLink.attr('href')}` });
                }
            }
        });
    });

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.status(200).json(scrapedSchedule);

  } catch (error) {
    console.error("ScraperAPI error:", error.message);
    res.status(500).json({ error: 'Failed to fetch schedule via ScraperAPI.', details: error.message });
  }
}


