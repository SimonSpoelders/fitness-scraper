// api/server.js - FINAL VERSION

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Instantiate the stealth plugin
const stealth = StealthPlugin();
// --- THE FIX: Remove the specific evasion that causes the error on Vercel ---
stealth.enabledEvasions.delete('chrome.app');
// Use the modified plugin
puppeteer.use(stealth);

export default async function handler(req, res) {
    let browser;
    try {
        browser = await puppeteer.launch({
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
            ],
        });
        
        const page = await browser.newPage();
        
        // Block unnecessary resources to speed up page load
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.goto('https://fit.gent/uurrooster/', { waitUntil: 'domcontentloaded' });

        const cookieButtonSelector = 'button.cmplz-btn.cmplz-accept';
        try {
            await page.waitForSelector(cookieButtonSelector, { timeout: 3000 });
            await page.click(cookieButtonSelector);
        } catch (e) {
            console.log("Cookie consent button not found or not needed.");
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
        
        // Send the data back with caching headers
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
        res.status(200).json(scheduleData);

    } catch (error) {
        console.error("Runtime error:", error.message);
        res.status(500).json({ error: 'Failed to scrape the website.', details: error.message });
    } finally {
        if (browser) await browser.close();
    }
}


