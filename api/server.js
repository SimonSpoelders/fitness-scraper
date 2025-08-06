// api/server.js - FINAL SIMPLE VERSION

import axios from 'axios';
import * as cheerio from 'cheerio';

// The URL for the website's internal API
const API_URL = 'https://fit.gent/wp-admin/admin-ajax.php';

export default async function handler(req, res) {
  try {
    // We need to send a POST request with a specific 'action' payload,
    // just like the real website does.
    const response = await axios.post(
      API_URL,
      new URLSearchParams({
        action: 'wcs_get_week_html',
        calendar_id: '1',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    // The server responds with JSON that contains the schedule's HTML
    const html = response.data.data;
    const $ = cheerio.load(html);

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


