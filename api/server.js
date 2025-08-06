// api/server.js - FINAL ARCHITECTURE

import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export default async function handler(req, res) {
    let browser;
    try {
        // --- The key change: We configure puppeteer to use our special Chromium package ---
        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        });

        const page = await browser.newPage();

        // This part of the logic is the same
        await page.goto('https://fit.gent/uurrooster/', { waitUntil: 'domcontentloaded' });

        const cookieButtonSelector = 'button.cmplz-btn.cmplz-accept';
        try {
            await page.waitForSelector(cookieButtonSelector, { timeout: 3000 });
            await page.click(cookieButtonSelector);
        } catch (e) {
            // It's okay if the cookie button isn't found
        }

        await page.waitForSelector('table.uurrooster', { timeout: 8000 });

        const scheduleData = await page.evaluate(() => {
            const scrapedSchedule = {};
            const days = [];
            const dayElements = document.querySelectorAll('table.uurrooster thead th');
            dayElements.forEach((el, i) => { if (i > 0) days.push(el.innerText.trim()); });
            days.forEach(day => scrapedSchedule[day] = []);
            const rowElements = document.querySelectorAll('table.uurrooster tbody tr');
            rowElements.forEach((rowEl) => {
                const time = rowEl.querySelector('td').innerText.trim();
                const lessonCells = rowEl.querySelectorAll('td');
                lessonCells.forEach((colEl, colIndex) => {
                    if (colIndex > 0) {
                        const day = days[colIndex - 1];
                        if (day) {
                            const lessonLink = colEl.querySelector('div.les-uurrooster a');
                            if (lessonLink) {
                                scrapedSchedule[day].push({ time: time, name: lessonLink.innerText.trim(), url: `https://fit.gent${lessonLink.getAttribute('href')}` });
                            }
                        }
                    }
                });
            });
            return scrapedSchedule;
        });

        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
        res.status(200).json(scheduleData);

    } catch (error) {
        console.error("Runtime error:", error.message);
        res.status(500).json({ error: 'Failed to scrape the website.', details: error.message });
    } finally {
        if (browser) await browser.close();
    }
}


