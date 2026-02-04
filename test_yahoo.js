import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance();
console.log("yf.quote:", yf.quote);

if (yf.quote) {
    console.log("Found quote! Testing BUMI...");
    try {
        const q = await yf.quote('BUMI.JK');
        console.log("Got quote:", q);
    } catch (e) { console.error(e.message); }
} else {
    console.log("Still undefined!");
}
