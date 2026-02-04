import fetch from 'node-fetch'; // Standard fetch or node-fetch
// Note: In Node 18+ global fetch is available 

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function testYahooDirect(symbol) {
    console.log(`\nTesting Yahoo Direct for ${symbol}...`);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    try {
        const res = await fetch(url, { headers: { 'User-Agent': UA } });
        console.log(`Status: ${res.status}`);
        if (res.ok) {
            const json = await res.json();
            const meta = json.chart.result[0].meta;
            console.log(`Price: ${meta.regularMarketPrice}`);
            console.log(`PrevClose: ${meta.previousClose}`);
            console.log("SUCCESS!");
        } else {
            console.log("Failed:", await res.text());
        }
    } catch (e) {
        console.log("Error:", e.message);
    }
}

async function testGoogleScrape(symbol) {
    // Symbol format for google: BBCA:IDX or INET:IDX
    const gSymbol = symbol.replace('.JK', ':IDX');
    console.log(`\nTesting Google Scrape for ${gSymbol}...`);
    const url = `https://www.google.com/finance/quote/${gSymbol}`;
    try {
        const res = await fetch(url, { headers: { 'User-Agent': UA } });
        console.log(`Status: ${res.status}`);
        if (res.ok) {
            const html = await res.text();
            // Look for "last price" class or data
            // Just a quick check if we get the page
            console.log(`Length: ${html.length}`);
            if (html.includes("autocorrect-search-input")) console.log("Page loaded mostly correct.");
            else console.log("Might be a captcha or block page.");
        }
    } catch (e) {
        console.log("Error:", e.message);
    }
}

async function run() {
    await testYahooDirect('BBCA.JK');
    await testYahooDirect('INET.JK');
    await testGoogleScrape('BBCA.JK');
}

run();
