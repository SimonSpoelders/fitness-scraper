// api/server.js - SYNTAX FIX

// --- FIX: Use 'import' instead of 'require' ---
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

// The rest of the diagnostic script is the same
export default async function handler(req, res) {
    console.log("--- DIAGNOSTIC SCRIPT RUNNING (v2) ---");
    let browser;

    try {
        browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });
        console.log("1. Browser launched.");
        
        const page = await browser.newPage();
        console.log("2. New page created.");
        
        await page.goto('https://fit.gent/uurrooster/', { waitUntil: 'networkidle0', timeout: 9000 });
        console.log("3. Navigated to URL.");
        
        const pageContent = await page.content();
        console.log("4. Page content received. Snippet:", pageContent.substring(0, 500));

        const cookieButtonSelector = 'button.cmplz-btn.cmplz-accept';
        try {
            await page.click(cookieButtonSelector, { timeout: 1000 });
            console.log("5. Cookie button clicked successfully.");
        } catch(e) {
            console.log("5. Cookie button not found or couldn't be clicked.");
        }
        
        console.log("6. Waiting for schedule table selector...");
        await page.waitForSelector('table.uurrooster', { timeout: 8000 });
        console.log("7. SUCCESS: Schedule table selector was found!");
        
        res.status(200).json({ status: 'Success', message: 'The table selector was found on the page.' });

    } catch (error) {
        console.error("--- SCRIPT FAILED ---");
        console.error("ERROR at step after last successful log.");
        console.error("Error message:", error.message);
        console.error("--- END OF ERROR ---");
        res.status(500).json({ 
            error: 'The scraper failed to run.',
            details: error.message 
        });
    } finally {
        if (browser) await browser.close();
        console.log("Browser closed. Function finished.");
    }
}


