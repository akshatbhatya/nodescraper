import puppeteer from 'puppeteer';
import fs from 'fs';

async function runScraper(searchQueryInput) {
  
    
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    const searchQuery = searchQueryInput;
    if (!searchQuery) {
        throw new Error("Please provide a search query");
    }

    // Generate dynamic filename based on search query
    const sanitizedQuery = searchQuery.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
    const outputFile = `${sanitizedQuery}.json`;

    const browser = await puppeteer.launch({
        headless: false,
        executablePath: '/usr/bin/google-chrome', // or /usr/bin/chromium-browser
        args: ['--no-sandbox', '--disable-dev-shm-usage']
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        await page.goto("https://www.google.com/maps", { waitUntil: "networkidle2" });

        // Accept cookies if needed
        try {
            await page.waitForSelector('button[aria-label="Accept all"]', { timeout: 2000 });
            await page.click('button[aria-label="Accept all"]');
            await sleep(1000);
        } catch (err) {
            console.log("No cookie consent button found or error accepting cookies:", err.message);
        }

        // Search for the provided query
        await page.waitForSelector("input#searchboxinput", { timeout: 10000 });
        await page.type("input#searchboxinput", searchQuery);
        await page.click("button#searchbox-searchbutton");
        await sleep(5000); // Wait for search results to load

        // Wait for listings to appear
        try {
            await page.waitForSelector('.Nv2PK', { timeout: 10000 });
        } catch (err) {
            console.log(`No listings found for "${searchQuery}". Saving empty results.`);
            fs.writeFileSync(outputFile, JSON.stringify([], null, 2));
            console.log(`✅ Data saved to ${outputFile}`);
            return JSON.stringify([], null, 2);
        }

        // Scroll to load all available results
        let maxScrollAttempts = 2000; // Maximum scroll attempts
        let scrollCount = 0;

        while (scrollCount < maxScrollAttempts) {
            const listingCount = await page.evaluate(() => document.querySelectorAll('.Nv2PK').length);
            console.log(`Scroll attempt ${scrollCount + 1}: Found ${listingCount} listings`);

            await page.evaluate('document.querySelector(".m6QErb.DxyBCb.kA9KIf.dS8AEf.ecceSd")?.scrollTo(0, document.querySelector(".m6QErb.DxyBCb.kA9KIf.dS8AEf.ecceSd").scrollHeight)');
            await sleep(4000); // Delay for slow-loading content

            // Check if new listings appeared
            const newListingCount = await page.evaluate(() => document.querySelectorAll('.Nv2PK').length);
            if (newListingCount === listingCount) {
                console.log("No new listings loaded, stopping scroll.");
                break;
            }

            scrollCount++;
        }

        // Extract data from search results
        const listings = await page.evaluate(() => {
            const items = [];
            document.querySelectorAll('.Nv2PK').forEach(el => {
                const name = el.querySelector('.qBF1Pd')?.innerText.trim() || '';
                const rating = el.querySelector('.MW4etd')?.innerText.trim() || '';
                const reviewCount = el.querySelector('.UY7F9')?.innerText.replace(/[()]/g, '').trim() || '';
                let address = '';
                el.querySelectorAll('.W4Efsd span').forEach(span => {
                    const txt = span.innerText.trim();
                    // Exclude ratings, hours, accessibility icons, separators, and common types
                    if (txt && !txt.includes('Closed') && !txt.includes('Opens') && !txt.includes('·') && !txt.match(/^[0-5]\.[0-9]/) && !txt.match(/[\uE000-\uF8FF]/)) {
                        address += txt + ' ';
                    }
                });
                const link = el.querySelector('a.hfpxzc')?.href || '';
                const hours = el.querySelector('.W4Efsd span[style*="color: rgba(220,54,46,1.00)"]')?.parentElement.innerText.trim() || '';
                // Extract type (dynamic, not limited to specific types)
                let type = '';
                el.querySelectorAll('.W4Efsd span').forEach(span => {
                    const txt = span.innerText.trim();
                    // Identify type by excluding address, hours, and other non-type text
                    if (txt && !txt.includes('Closed') && !txt.includes('Opens') && !txt.includes('·') && !txt.match(/^[0-5]\.[0-9]/) && !txt.match(/[\uE000-\uF8FF]/) && !address.includes(txt)) {
                        type = txt;
                    }
                });
                const bookingLink = el.querySelector('.A1zNzb')?.href || '';
                const reviewSnippet = el.querySelector('.ah5Ghc span')?.innerText.trim() || '';

                if (name && link) {
                    items.push({
                        name,
                        address: address.trim(),
                        link,
                        rating,
                        reviewCount,
                        hours,
                        type,
                        bookingLink,
                        reviewSnippet
                    });
                }
            });
            return items;
        });

        console.log(`✅ Found ${listings.length} listings for "${searchQuery}".`);

        const results = [];

        // Visit each listing to get phone number and website
        for (const item of listings) {
            console.log(`Visiting: ${item.name} (${item.link})`);
            try {
                await page.goto(item.link, { waitUntil: 'networkidle2', timeout: 15000 });
                await sleep(5000); // Increased delay for dynamic content

                // Retry phone number extraction up to 3 times
                let phone = '';
                let website = '';
                for (let retry = 0; retry < 3; retry++) {
                    const data = await page.evaluate(() => {
                        // Try primary phone button
                        let phoneText = document.querySelector('button[data-item-id*="phone"]')?.innerText.trim() || '';
                        // Fallback to text elements containing phone number
                        if (!phoneText) {
                            const textElements = document.querySelectorAll('.Io6YTe');
                            for (const el of textElements) {
                                const txt = el.innerText.trim();
                                if (txt.match(/^\+?\d[\d\s-]{8,}$/)) {
                                    phoneText = txt;
                                    break;
                                }
                            }
                        }
                        // Extract website
                        const websiteBtn = document.querySelector('a[data-item-id*="authority"]');
                        const websiteUrl = websiteBtn ? websiteBtn.href : '';
                        return { phone: phoneText, website: websiteUrl };
                    });

                    phone = data.phone.replace(/[^\d\s+]/g, '').trim();
                    website = data.website;

                    if (phone) break; // Exit retry loop if phone is found
                    console.log(`Retry ${retry + 1} for phone number: ${item.name}`);
                    await sleep(2000); 
                }

                results.push({
                    name: item.name,
                    address: item.address,
                    phone,
                    website,
                    rating: item.rating,
                    reviewCount: item.reviewCount,
                    hours: item.hours,
                    type: item.type,
                    bookingLink: item.bookingLink,
                    reviewSnippet: item.reviewSnippet,
                    link: item.link
                });
            } catch (err) {
                console.error(`Error visiting ${item.name}: ${err.message}`);
                results.push({
                    name: item.name,
                    address: item.address,
                    phone: '',
                    website: '',
                    rating: item.rating,
                    reviewCount: item.reviewCount,
                    hours: item.hours,
                    type: item.type,
                    bookingLink: item.bookingLink,
                    reviewSnippet: item.reviewSnippet,
                    link: item.link
                });
            }
        }

        fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
        console.log(`✅ Data saved to ${outputFile}`);

        return JSON.stringify(results, null, 2);

    } finally {
        await browser.close();
    }
}

export default runScraper;