// api/server.js - FINAL TWO-STEP AUTHENTICATION

import axios from 'axios';
import * as cheerio from 'cheerio';

const SCHEDULE_PAGE_URL = 'https://fit.gent/uurrooster/';
const API_URL = 'https://fit.gent/wp-admin/admin-ajax.php';

export default async function handler(req, res) {
  try {
    // --- STEP 1: Fetch the main page to get the security nonce ---
    const pageResponse = await axios.get(SCHEDULE_PAGE_URL);
    const pageHtml = pageResponse.data;

    // Use a regular expression to find the nonce in the inline script
    const nonceMatch = pageHtml.match(/var wcs_ajax_object = .*?"security":"(.*?)"/);
    if (!nonceMatch || !nonceMatch[1]) {
      throw new Error('Could not find security nonce on the page.');
    }
    const nonce = nonceMatch[1];

    // --- STEP 2: Use the nonce to make the real API call ---
    const apiResponse = await axios.post(
      API_URL,
      new URLSearchParams({
        action: 'wcs_get_week_html',
        calendar_id: '1',
        security: nonce, // Include the dynamic security nonce
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    // The rest of the logic is the same: parse the HTML from the API response
    const scheduleHtml = apiResponse.data.data;
    const $ = cheerio.load(scheduleHtml);

    const scrapedSchedule = {};
    const days = [];
    
    $('table.uurrooster thead th').each((i, el) => {
        if (i > 0) days.push($(el).text().trim());
    });

    days.forEach(day => scrapedSchedule[day] = []);

    $('table.uurrooster tbody tr').each((rowIndex, rowEl) => {
        const time = $(rowEl).find('td').first().text().trim();
        $(rowEl).find('td').slice(1).each((colIndex, colEl) => {
            const day = days[colIndex];
            if (day) {
                $(colEl).find('div.les-uurrooster a').each((linkIndex, linkEl) => {
                    const lessonName = $(linkEl).text().trim();
                    const lessonUrl = $(linkEl).attr('href');
                    if (lessonName) {
                        scrapedSchedule[day].push({ time, name: lessonName, url: `https://fit.gent${lessonUrl}` });
                    }
                });
            }
        });
    });

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.status(200).json(scrapedSchedule);

  } catch (error) {
    console.error("API call error:", error.message);
    res.status(500).json({ error: 'Failed to fetch schedule from the API.' });
  }
}


