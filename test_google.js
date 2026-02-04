import * as cheerio from 'cheerio';
import fetch from 'node-fetch';

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function scrapeGoogle(symbol) {
    const gSymbol = symbol.replace('.JK', ':IDX');
    const url = `https://www.google.com/finance/quote/${gSymbol}`;
    console.log(`Scraping ${url}...`);

    try {
        const res = await fetch(url, { headers: { 'User-Agent': UA } });
        const html = await res.text();
        const $ = cheerio.load(html);

        // Google Finance Selectors (Class names might change, but these are common)
        // Usually div.YMlKec.fxKbKc is big price text
        const price = $('.YMlKec.fxKbKc').first().text().replace(/[^0-9.-]/g, '');

        // Percent Change: div.JwB6zf
        const percentRaw = $('.JwB6zf').first().text();
        // Or look for aria-label or specific positive/negative classes

        console.log(`Raw Price: ${price}`);
        console.log(`Raw Change: ${percentRaw}`);

        if (price) {
            return {
                c: parseFloat(price),
                dp: parseFloat(percentRaw.replace('%', '').replace('+', ''))
            };
        }
        return null;
    } catch (e) {
        console.error("Error:", e.message);
        return null;
    }
}

scrapeGoogle('BBCA.JK').then(console.log);
scrapeGoogle('INET.JK').then(console.log);
