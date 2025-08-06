// api/server.js - FINAL VERSION WITH DATE

import axios from 'axios';
import * as cheerio from 'cheerio';

const SCHEDULE_PAGE_URL = 'https://fit.gent/uurrooster/';
const API_URL = 'https://fit.gent/wp-admin/admin-ajax.php';

export default async function handler(req, res) {
  try {
    // --- STEP 1: Get the security nonce from the main page ---
    const pageResponse = await axios.get(SCHEDULE_PAGE_URL);
    const pageHtml = pageResponse.data;

    const nonceMatch = pageHtml.match(/var wcs_ajax_object = .*?"security":"(.*?)"/);
    if (!nonceMatch || !nonceMatch[1]) {
      throw new Error('Could not find security nonce on the page.');
    }
    const nonce = nonceMatch[1];
    
    // --- THE FIX: Get today's date in YYYY-MM-DD format ---
    const today = new Date().toISOString().slice(0, 10);

    // --- STEP 2: Make the API call with the nonce AND the date ---
    const apiResponse = await axios.post(
      API_URL,
      new URLSearchParams({
        action: 'wcs_get_week_html',
        calendar_id: '1',
        security: nonce,
        date: today, // Add the missing date parameter
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const scheduleHtml = apiResponse.data.data;
    const $ = cheerio.load(scheduleHtml);

    // This scraping logic is correct and remains unchanged
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
    // Better error logging
    console.error("--- DETAILED ERROR ---");
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error("Data:", error.response.data);
      console.error("Status:", error.response.status);
      console.error("Headers:", error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      console.error("Request:", error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error Message:', error.message);
    }
    console.error("--- END DETAILED ERROR ---");
    
    res.status(500).json({ error: 'Failed to fetch schedule from the API.' });
  }
}


