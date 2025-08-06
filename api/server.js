// api/server.js

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

export default async function handler(req, res) {
    console.log("Optimized function invoked.");
    let browser;

    try {
        browser = await puppeteer.launch({
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--single-process'
            ],
        });
        
        const page = await browser.newPage();

        // --- NEW: Block unnecessary requests to speed up page load ---
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'script'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.goto('https://fit.gent/uurrooster/', { waitUntil: 'domcontentloaded' });

        const cookieButtonSelector = 'button.cmplz-btn.cmplz-accept';
        try {
            // We'll give the cookie button less time to appear
            await page.waitForSelector(cookieButtonSelector, { timeout: 3000 });
            await page.click(cookieButtonSelector);
        } catch (e) {
            console.log("Cookie consent button not found or not needed.");
        }
        
        // --- NEW: Reduced timeout to stay within Vercel's 10-second limit ---
        await page.waitForSelector('table.uurrooster', { timeout: 8000 }); // 8 seconds

        const scheduleData = await page.evaluate(() => {
            // This scraping logic is already fast, no changes needed here.
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
        console.error("RUNTIME ERROR:", error);
        res.status(500).json({ 
            error: 'Failed to scrape the website.',
            details: error.message 
        });
    } finally {
        if (browser) await browser.close();
    }
}


