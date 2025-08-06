// api/server.js - FINAL VERSION WITHOUT DATE PARAMETER

import axios from 'axios';
import * as cheerio from 'cheerio';

const SCHEDULE_PAGE_URL = 'https://fit.gent/uurrooster/';
const API_URL = 'https://fit.gent/wp-admin/admin-ajax.php';

const BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9'
};

export default async function handler(req, res) {
  try {
    const pageResponse = await axios.get(SCHEDULE_PAGE_URL, { headers: BROWSER_HEADERS });
    const pageHtml = pageResponse.data;

    const nonceMatch = pageHtml.match(/var wcs_ajax_object = .*?"security":"(.*?)"/);
    if (!nonceMatch || !nonceMatch[1]) {
      throw new Error('Could not find security nonce on the page.');
    }
    const nonce = nonceMatch[1];

    // --- THE FIX: Make the API call WITHOUT a date parameter ---
    const apiResponse = await axios.post(
      API_URL,
      new URLSearchParams({
        action: 'wcs_get_week_html',
        calendar_id: '1',
        security: nonce,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const scheduleHtml = apiResponse.data.data;
    const $ = cheerio.load(scheduleHtml);
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
    console.error("Final error:", error.message);
    res.status(500).json({ error: 'Failed to fetch schedule.', details: error.message });
  }
}


