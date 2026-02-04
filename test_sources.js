import * as cheerio from 'cheerio';
import fetch from 'node-fetch';

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function testYahooWeb(symbol) {
    const url = `https://finance.yahoo.com/quote/${symbol}`;
    console.log(`Scraping Yahoo Web: ${url}`);

    try {
        const res = await fetch(url, { headers: { 'User-Agent': UA } });
        const html = await res.text();
        const $ = cheerio.load(html);

        // Yahoo classes often change, but "fin-streamer" is reliable
        // <fin-streamer data-symbol="BBCA.JK" data-field="regularMarketPrice" ...>10,125.00</fin-streamer>

        const price = $(`fin-streamer[data-field="regularMarketPrice"][data-symbol="${symbol}"]`).text();
        const change = $(`fin-streamer[data-field="regularMarketChange"][data-symbol="${symbol}"]`).text();
        const changePct = $(`fin-streamer[data-field="regularMarketChangePercent"][data-symbol="${symbol}"]`).text();

        console.log(`Yahoo Web - ${symbol}`);
        console.log(`Price: ${price}`);
        console.log(`Change: ${change}`);
        console.log(`Pct: ${changePct}`);

    } catch (e) { console.log("Yahoo Error:", e.message); }
}

testYahooWeb('BBCA.JK');
