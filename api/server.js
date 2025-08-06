// api/server.js

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

// This is the main function Vercel will run
export default async function handler(req, res) {
    console.log("Serverless function invoked.");
    let browser;

    try {
        browser = await puppeteer.launch({
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
            ],
        });
        console.log("Browser launched on Vercel.");

        const page = await browser.newPage();
        await page.goto('https://fit.gent/uurrooster/', { waitUntil: 'networkidle2' });
        console.log("Navigated to page.");

        const cookieButtonSelector = 'button.cmplz-btn.cmplz-accept';
        try {
            await page.waitForSelector(cookieButtonSelector, { timeout: 5000 });
            await page.click(cookieButtonSelector);
            console.log("Cookie button clicked.");
            await new Promise(r => setTimeout(r, 2000));
        } catch (e) {
            console.log("Cookie button not found.");
        }

        await page.waitForSelector('table.uurrooster', { timeout: 15000 });
        console.log("Schedule table found.");

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

        console.log("Scraping successful.");
        // Send the data back with caching headers
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
        res.status(200).json(scheduleData);

    } catch (error) {
        console.error("CRITICAL ERROR in Vercel function:", error);
        res.status(500).json({ error: 'Failed to scrape the website.' });
    } finally {
        if (browser) await browser.close();
    }
}


