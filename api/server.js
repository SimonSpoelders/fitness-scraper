// api/server.js - FINAL HYBRID ARCHITECTURE

import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import axios from 'axios';
import * as cheerio from 'cheerio';

const SCHEDULE_PAGE_URL = 'https://fit.gent/uurrooster/';
const API_URL = 'https://fit.gent/wp-admin/admin-ajax.php';

async function getSecurityNonce() {
    let browser;
    try {
        browser = await puppeteer.launch({
            args: chromium.args,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });
        const page = await browser.newPage();
        await page.goto(SCHEDULE_PAGE_URL, { waitUntil: 'domcontentloaded' });

        // Evaluate the page's JavaScript to get the nonce
        const securityNonce = await page.evaluate(() => {
            // This global JS variable is set by the page's scripts
            return window.wcs_ajax_object.security;
        });

        if (!securityNonce) {
            throw new Error('wcs_ajax_object.security not found on page.');
        }
        return securityNonce;

    } finally {
        if (browser) await browser.close();
    }
}

export default async function handler(req, res) {
    try {
        // --- STEP 1: Use Puppeteer to get the nonce ---
        const nonce = await getSecurityNonce();

        // --- STEP 2: Use Axios with the nonce to get the schedule ---
        const today = new Date().toISOString().slice(0, 10);
        const apiResponse = await axios.post(
            API_URL,
            new URLSearchParams({
                action: 'wcs_get_week_html',
                calendar_id: '1',
                security: nonce,
                date: today,
            })
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
        console.error("Final handler error:", error.message);
        res.status(500).json({ error: 'The scraper failed.', details: error.message });
    }
}


