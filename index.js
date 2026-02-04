/**
 * 🚀 STOCKBIT BOT - AI TRADING ASSISTANT FOR BEI (IDX)
 * Gen Z Edition: Moon or Bust 🌙
 * FULL IDX COVERAGE - Expanded Watchlist + NEW FEATURES
 */

import 'dotenv/config';
import { Telegraf } from 'telegraf';
import finnhub from 'finnhub';
import * as cheerio from 'cheerio';
import YahooFinance from 'yahoo-finance2'; // Import Class
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] }); // Instantiate!
import Groq from 'groq-sdk';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import figlet from 'figlet';
import { ALL_IDX_STOCKS } from './idx_stocks_comprehensive.js';
import { LIQUID_STOCKS } from './idx_liquid.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// ... existing config code ...

async function loadAllIDXStocks() {
    allIDXStocks = ALL_IDX_STOCKS;
    console.log(chalk.green.bold(`✅ Loaded ${allIDXStocks.length} IDX stocks (Full Coverage)`));
    console.log(chalk.cyan.bold(`⚡ Optimized for speed: Scanning ${LIQUID_STOCKS.length} Liquid Stocks`));
}

function getStocksToScan(limit = null) {
    // STARTUP OPTIMIZATION: Scan only liquid stocks to prevent rate limits & timeouts
    const stocks = LIQUID_STOCKS;
    return limit ? stocks.slice(0, limit) : stocks;
}

// --- CONFIG ---
const BOT_TOKEN = process.env.TELEGRAM_TOKEN;
const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
const GROQ_KEY = process.env.GROQ_API_KEY;

if (!BOT_TOKEN || !FINNHUB_KEY || !GROQ_KEY) {
    console.error(chalk.red.bold("❌ CRITICAL: .env incomplete!"));
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const groq = new Groq({ apiKey: GROQ_KEY });
const api_key = finnhub.ApiClient.instance.authentications['api_key'];
api_key.apiKey = FINNHUB_KEY;
const finnhubClient = new finnhub.DefaultApi();

// GLOBAL ERROR HANDLER
bot.catch((err, ctx) => {
    console.error(chalk.red(`❌ Telegraf Error for ${ctx.updateType}:`), err);
    // Try to reply if possible
    try { ctx.reply("❌ Bot encountered an error. Try again later."); } catch (e) { }
});

// LOGGING MIDDLEWARE
bot.use(async (ctx, next) => {
    // Log info about incoming updates
    if (ctx.message && ctx.message.text) {
        console.log(chalk.gray(`📩 [${ctx.from.username}] ${ctx.message.text}`));
    }
    await next();
});

const SUBSCRIBERS_FILE = path.join(__dirname, 'subscribers.json');
const WATCHLISTS_FILE = path.join(__dirname, 'watchlists.json');
const PRICE_CACHE_FILE = path.join(__dirname, 'price_cache.json');
const IDX_STOCKS_CACHE_FILE = path.join(__dirname, 'idx_stocks_cache.json');
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Fallback list (if Finnhub API fails)
const LQ45_FALLBACK = [
    "BBCA", "BBRI", "BMRI", "BBNI", "TLKM", "ASII", "UNTR", "ICBP", "GOTO", "AMMN",
    "BRPT", "ADRO", "ANTM", "INCO", "MDKA", "PGAS", "PTBA", "UNVR", "CPIN", "KLBF",
    "INDF", "GGRM", "EXCL", "BYAN", "ITMG", "TOWR", "MEDC", "SMGR", "JSMR", "CTRA"
];

// Will be populated on startup with ALL IDX stocks
let allIDXStocks = [];

let subscribers = [];
let watchlists = {}; // Format: { userId: ["BBCA", "GOTO", ...] }
let priceCache = {}; // Format: { "BBCA.JK": { data: {...}, timestamp: 123456 } }

try {
    if (fs.existsSync(SUBSCRIBERS_FILE)) {
        subscribers = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf-8'));
    }
} catch (err) {
    console.error(chalk.yellow("⚠️ Subscriber load error:", err));
}

try {
    if (fs.existsSync(WATCHLISTS_FILE)) {
        watchlists = JSON.parse(fs.readFileSync(WATCHLISTS_FILE, 'utf-8'));
    }
} catch (err) {
    console.error(chalk.yellow("⚠️ Watchlist load error:", err));
}

try {
    if (fs.existsSync(PRICE_CACHE_FILE)) {
        priceCache = JSON.parse(fs.readFileSync(PRICE_CACHE_FILE, 'utf-8'));
    }
} catch (err) {
    console.error(chalk.yellow("⚠️ Price cache load error:", err));
}

const saveSubscribers = () => {
    fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(subscribers, null, 2));
};

const saveWatchlists = () => {
    fs.writeFileSync(WATCHLISTS_FILE, JSON.stringify(watchlists, null, 2));
};

const savePriceCache = () => {
    fs.writeFileSync(PRICE_CACHE_FILE, JSON.stringify(priceCache, null, 2));
};

const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};



function escapeMarkdown(text) {
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

function calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return 0;
    let gains = 0, losses = 0;

    for (let i = 1; i <= period; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) gains += change;
        else losses += Math.abs(change);
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        avgGain = ((avgGain * (period - 1)) + (change > 0 ? change : 0)) / period;
        avgLoss = ((avgLoss * (period - 1)) + (change < 0 ? Math.abs(change) : 0)) / period;
    }

    return avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
}

function calculateSMA(prices, period) {
    if (prices.length < period) return 0;
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
}

function calculateEMA(prices, period) {
    const k = 2 / (period + 1);
    let ema = prices[0];
    for (let i = 1; i < prices.length; i++) {
        ema = prices[i] * k + ema * (1 - k);
    }
    return ema;
}

function calculateMACD(prices) {
    if (prices.length < 26) return { macd: 0, signal: 0, histogram: 0 };
    const ema12 = calculateEMA(prices.slice(-12), 12); // Approximate, usually precise EMA is recursive over whole set
    // A better way for short arrays:
    // ... actually for simplicity on small datasets, this is okay, but let's do recursive.

    // Recursive EMA for full array
    const getEMAArray = (data, p) => {
        let emas = [data[0]];
        const k = 2 / (p + 1);
        for (let i = 1; i < data.length; i++) {
            emas.push(data[i] * k + emas[i - 1] * (1 - k));
        }
        return emas;
    };

    const ema12Arr = getEMAArray(prices, 12);
    const ema26Arr = getEMAArray(prices, 26);

    const macdLine = [];
    for (let i = 0; i < prices.length; i++) {
        macdLine.push(ema12Arr[i] - ema26Arr[i]);
    }

    const signalLineArr = getEMAArray(macdLine.slice(-26), 9); // Signal is EMA(9) of MACD

    const currentMACD = macdLine[macdLine.length - 1];
    const currentSignal = signalLineArr[signalLineArr.length - 1];

    return {
        macd: currentMACD,
        signal: currentSignal,
        histogram: currentMACD - currentSignal
    };
}

const formatTicker = (ticker) => `${ticker.toUpperCase().replace('.JK', '').trim()}.JK`;

const getRealtimeQuote = async (symbol) => {
    // GOOGLE FINANCE SCRAPING (Primary for IDX)
    if (symbol.endsWith('.JK')) {
        try {
            const gSymbol = symbol.replace('.JK', ':IDX');
            const url = `https://www.google.com/finance/quote/${gSymbol}`;
            const res = await fetch(url, {
                headers: { 'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
            });

            if (res.ok) {
                const html = await res.text();
                const $ = cheerio.load(html);
                const price = $('.YMlKec.fxKbKc').first().text().replace(/[^0-9.-]/g, '');
                const percentRaw = $('.JwB6zf').first().text();

                if (price) {
                    const data = {
                        c: parseFloat(price),
                        dp: parseFloat(percentRaw.replace('%', '').replace('+', '')) || 0,
                        d: 0, // Delta not always easily parseable, but dp is enough for bot
                        h: 0, l: 0, o: 0, pc: 0 // Simplification for speed
                    };

                    // Cache it
                    priceCache[symbol] = { data, timestamp: Date.now() };
                    savePriceCache();
                    return data;
                }
            }
        } catch (e) {
            // console.log(chalk.yellow(`⚠️ Google/Scrape failed for ${symbol}: ${e.message}`));
        }
    }

    // Fallback: Cache (Last Resort if live fetch failed)
    if (priceCache[symbol]) {
        return { ...priceCache[symbol].data, cached: true, cachedTime: priceCache[symbol].timestamp };
    }

    throw new Error(`Data unavailable for ${symbol}`);
};

async function generateAIAnalysis(symbol, priceData, technicals) {
    const { rsi, sma20, macd, trend } = technicals;

    // Create a detailed context for the AI
    const dataContext = `
Symbol: ${symbol}
Price: ${priceData.c} (Change: ${priceData.dp.toFixed(2)}%)
Prev Close: ${priceData.pc}
High/Low: ${priceData.h} / ${priceData.l}

Technical Indicators:
- RSI (14): ${rsi.toFixed(2)} (${rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : 'Neutral'})
- SMA (20): ${sma20 ? sma20.toFixed(0) : 'N/A'} (Price is ${priceData.c > sma20 ? 'Above' : 'Below'} SMA)
- MACD: ${macd ? macd.macd.toFixed(3) : 'N/A'}
- MACD Signal: ${macd ? macd.signal.toFixed(3) : 'N/A'}
- Trend (Last 5 days): ${trend ? trend.map(p => p.toFixed(0)).join(' -> ') : 'N/A'}
    `;

    const prompt = `
Role: You are a professional, sharp, and "Gen Z" style stock trader calling "Hafischz". You analyze stocks with high accuracy based on technicals.

Context:
${dataContext}

Task:
Analyze the stock and provide a STRICT recommendation.

Guidelines:
1. **Decision**: MUST be one of [STRONG BUY 🚀, BUY 🟢, WAIT/HOLD 🟡, SELL �].
2. **Analysis**:
   - Why? (Combine RSI, MACD, and Price Action).
   - If RSI < 30 and price is rising -> Bullish Divergence?
   - If Price > SMA20 -> Uptrend?
   - If MACD > Signal -> Bullish Crossover?
3. **Targets**: Give rational Target Price (TP) and Stop Loss (SL) based on volatility (approx 2-5% range).
4. **Tone**: Confidence, short sentences, slang (e.g., "Gass", "Serok", "Cabut", "Ati-ati").

Format (Markdown):
*Keputusan*: [DECISION]

*Alasan*:
• [Bullet point 1]
• [Bullet point 2]
• [Bullet point 3]

*Setup*:
🎯 TP: [Price]
🛑 SL: [Price]

_Note: "Disclaimer on ya bos!"_
`;

    try {
        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: "You are an expert stock analyst bot for the Indonesian market. Be accurate, concise, and professional but cool." },
                { role: "user", content: prompt }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.6,
            max_tokens: 450,
        });
        return completion.choices[0].message.content;
    } catch (e) {
        console.error(chalk.red("Groq Error:", e));
        return "⚠️ AI lagi pusing, server overload. Coba bentar lagi!";
    }
}

// --- COMMANDS ---

bot.start((ctx) => {
    ctx.reply(`
*YO BRO\\! MOON BOT* 🚀💰

*Commands:*
➤ /price \\<kode\\> \\- Quick price check
➤ /analisis \\<kode\\> \\- AI deep dive
➤ /bpjs \\- AI picks BPJS \\(momentum\\)
➤ /bsjp \\- AI picks BSJP \\(oversold\\)
➤ /trending \\- Scan ${escapeMarkdown(getStocksToScan().length.toString())}\\+ stocks 
➤ /topgainers \\- Top gainers
➤ /losers \\- Top losers
➤ /watchlist \\- Personal tracker
➤ /subscribe \\- Auto alerts

_DYOR\\!_ Let's get bread\\! 💸
`, { parse_mode: 'MarkdownV2' });
});

// PRICE - Quick Check
bot.command('price', async (ctx) => {
    const input = ctx.message.text.split(' ')[1];
    if (!input) {
        return ctx.reply("❌ `/price <KODE>` \\- Contoh: `/price BBCA`", { parse_mode: 'MarkdownV2' });
    }

    const symbol = formatTicker(input);

    try {
        const quote = await getRealtimeQuote(symbol);
        if (quote.c === 0) throw new Error("No data");

        const reaction = quote.dp > 0 ? "🚀" : (quote.dp < 0 ? "🔻" : "➖");
        const pct = quote.dp > 0 ? `\\+${quote.dp.toFixed(2)}` : escapeMarkdown(quote.dp.toFixed(2));

        const cleanTicker = symbol.replace('.JK', '');
        ctx.reply(
            `💰 *[${escapeMarkdown(cleanTicker)}](https://stockbit.com/symbol/${cleanTicker})*: ${escapeMarkdown(quote.c.toString())} ${reaction} ${pct}%`,
            { parse_mode: 'MarkdownV2' }
        );
        console.log(chalk.cyan(`💰 Price check: ${symbol}`));
    } catch (error) {
        console.error(chalk.red(`❌ Price check error for ${symbol}:`), error.message);
        ctx.reply(`❌ Gagal cek ${escapeMarkdown(input)}`, { parse_mode: 'MarkdownV2' });
    }
});

bot.command('analisis', async (ctx) => {
    const input = ctx.message.text.split(' ')[1];
    if (!input) {
        return ctx.reply("❌ `/analisis <KODE>` \\- Contoh: `/analisis BBCA`", { parse_mode: 'MarkdownV2' });
    }

    const symbol = formatTicker(input);
    const msg = await ctx.reply(`🔍 Analisa *${escapeMarkdown(symbol)}*\\.\\.\\. ⏳`, { parse_mode: 'MarkdownV2' });

    try {
        const quote = await getRealtimeQuote(symbol);
        if (quote.c === 0) throw new Error("No data");

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 45); // Get slightly more than 1mo to ensure valid RSI

        const chart = await Promise.race([
            yahooFinance.chart(symbol, {
                period1: startDate.toISOString().split('T')[0],
                period2: endDate.toISOString().split('T')[0],
                interval: '1d'
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000))
        ]);
        const closes = chart.quotes.map(q => q.close).filter(c => c);

        const rsi = calculateRSI(closes);
        const sma20 = calculateSMA(closes, 20);
        const macd = calculateMACD(closes);
        const trend = closes.slice(-5);

        const aiAnalysis = await generateAIAnalysis(symbol, quote, { rsi, sma20, macd, trend });

        const reaction = quote.dp > 0 ? "🚀" : (quote.dp < 0 ? "🔻" : "➖");
        const pct = quote.dp > 0 ? `\\+${quote.dp.toFixed(2)}` : escapeMarkdown(quote.dp.toFixed(2));
        const rsiVibe = rsi > 70 ? "_\\(Overbought⚠️\\)_" : (rsi < 30 ? "_\\(Oversold✅\\)_" : "_\\(Neutral\\)_");

        const msg2 = `
📊 *[${escapeMarkdown(symbol)}](https://stockbit.com/symbol/${symbol.replace('.JK', '')})*

💰 ${escapeMarkdown(quote.c.toString())} ${reaction} ${pct}%
📈 H: ${escapeMarkdown(quote.h.toString())} L: ${escapeMarkdown(quote.l.toString())}

⚙️ *TEKNIKAL*
• RSI: ${escapeMarkdown(rsi.toFixed(2))} ${rsiVibe}
• SMA20: ${escapeMarkdown(sma20.toFixed(0))}
• MACD: ${escapeMarkdown(macd.macd.toFixed(2))} \\(Sig: ${escapeMarkdown(macd.signal.toFixed(2))}\\)

🤖 *AI*
${escapeMarkdown(aiAnalysis)}

_Gaspol?_ 💪🔥
`;
        await ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, null, msg2, { parse_mode: 'MarkdownV2' });
        console.log(chalk.green(`✅ ${symbol}`));
    } catch (error) {
        console.error(chalk.red(error));
        ctx.reply(`❌ Error ${escapeMarkdown(symbol)}\\. Bursa tutup?`, { parse_mode: 'MarkdownV2' });
    }
});

bot.command('trending', async (ctx) => {
    const statusMsg = await ctx.reply(
        `🔍 *Scanning ${getStocksToScan().length} stocks*\\.\\.\\.\n_Hold 30s_\\.\\.\\.`,
        { parse_mode: 'MarkdownV2' }
    );

    try {
        const results = [];
        const batchSize = 12; // Optimized for Google Scraper speed

        for (let i = 0; i < getStocksToScan().length; i += batchSize) {
            const batch = getStocksToScan().slice(i, i + batchSize);

            const batchResults = await Promise.all(
                batch.map(async (ticker) => {
                    try {
                        const q = await getRealtimeQuote(`${ticker}.JK`);
                        return { ticker, ...q };
                    } catch (e) { return null; }
                })
            );

            results.push(...batchResults.filter(r => r));
            if (i + batchSize < getStocksToScan().length) {
                await new Promise(r => setTimeout(r, 100));
            }
        }

        const trending = results.filter(r => r.dp > 2).sort((a, b) => b.dp - a.dp).slice(0, 15);

        if (trending.length === 0) {
            return ctx.telegram.editMessageText(
                ctx.chat.id, statusMsg.message_id, null,
                `😴 *Market sepi*\\.\\.\\.\n\nScanned ${getStocksToScan().length}\\. Chill\\! ☕`,
                { parse_mode: 'MarkdownV2' }
            );
        }

        let text = `🔥 *TOP ${trending.length} BPJS VIBES* 🔥\n\n`;
        trending.forEach((s, i) => {
            const icon = i < 3 ? "🚀" : "⚡";
            const cleanTicker = s.ticker.replace('.JK', '');
            text += `${icon} *[${escapeMarkdown(s.ticker)}](https://stockbit.com/symbol/${cleanTicker})*: \\+${escapeMarkdown(s.dp.toFixed(2))}%\n`;
        });
        text += `\n_Scanned ${getStocksToScan().length} stocks_ 💰`;

        await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, text, { parse_mode: 'MarkdownV2' });
        console.log(chalk.magenta(`🔥 ${trending.length} trending`));
    } catch (e) {
        console.error(chalk.red(e));
        ctx.reply("❌ Error\\!", { parse_mode: 'MarkdownV2' });
    }
});

bot.command('topgainers', async (ctx) => {
    ctx.reply(`🏆 *Scanning*\\.\\.\\. ⏳`, { parse_mode: 'MarkdownV2' });

    try {
        const results = await Promise.all(
            getStocksToScan().map(async (ticker) => {
                try {
                    const q = await getRealtimeQuote(`${ticker}.JK`);
                    return { ticker, ...q };
                } catch (e) { return null; }
            })
        );

        const gainers = results.filter(r => r && r.dp > 0).sort((a, b) => b.dp - a.dp).slice(0, 10);

        let msg = `🏆 *TOP GAINERS* 🌙\n\n`;
        gainers.forEach((g, i) => {
            const medal = ['🥇', '🥈', '🥉'][i] || "🔸";
            const cleanTicker = g.ticker.replace('.JK', '');
            msg += `${medal} *[${escapeMarkdown(g.ticker)}](https://stockbit.com/symbol/${cleanTicker})*: \\+${escapeMarkdown(g.dp.toFixed(2))}%\n`;
        });
        msg += "\n_/analisis for deep dive_ 💎";

        ctx.reply(msg, { parse_mode: 'MarkdownV2' });
    } catch (e) {
        ctx.reply("❌ Error\\!", { parse_mode: 'MarkdownV2' });
    }
});

// LOSERS - BSJP Strategy
bot.command('losers', async (ctx) => {
    ctx.reply(`🔻 *Scanning losers*\\.\\.\\. ⏳`, { parse_mode: 'MarkdownV2' });

    try {
        const results = await Promise.all(
            getStocksToScan().map(async (ticker) => {
                try {
                    const q = await getRealtimeQuote(`${ticker}.JK`);
                    return { ticker, ...q };
                } catch (e) { return null; }
            })
        );

        const losers = results.filter(r => r && r.dp < 0).sort((a, b) => a.dp - b.dp).slice(0, 10);

        if (losers.length === 0) {
            return ctx.reply("😴 *Semua saham hijau bro\\!* 🟢", { parse_mode: 'MarkdownV2' });
        }

        let msg = `🔻 *TOP LOSERS \\- BSJP HUNTING* 🎯\n_Potential reversal plays_\n\n`;
        losers.forEach((g, i) => {
            const medal = ['💀', '🩸', '🔻'][i] || "⬇️";
            const cleanTicker = g.ticker.replace('.JK', '');
            msg += `${medal} *[${escapeMarkdown(g.ticker)}](https://stockbit.com/symbol/${cleanTicker})*: ${escapeMarkdown(g.dp.toFixed(2))}%\n`;
        });
        msg += "\n_Oversold? Check /analisis \\<kode\\>_ 🔧";

        ctx.reply(msg, { parse_mode: 'MarkdownV2' });
        console.log(chalk.red(`🔻 ${losers.length} losers sent`));
    } catch (e) {
        console.error(chalk.red(e));
        ctx.reply("❌ Error\\!", { parse_mode: 'MarkdownV2' });
    }
});

// Debug middleware
bot.use(async (ctx, next) => {
    console.log(chalk.gray(`📩 Update from ${ctx.from?.username || ctx.from?.id}: ${ctx.message?.text || 'unknown type'}`));
    await next();
});

// WATCHLIST - Personal Tracking
bot.command('watchlist', async (ctx) => {
    const userId = ctx.chat.id;
    const args = ctx.message.text.split(' ');
    const action = args[1]?.toLowerCase();
    const ticker = args[2]?.toUpperCase();

    // Initialize watchlist for user if not exists
    if (!watchlists[userId]) watchlists[userId] = [];

    // ADD
    if (action === 'add' && ticker) {
        if (watchlists[userId].includes(ticker)) {
            return ctx.reply(`*${escapeMarkdown(ticker)}* udah ada di watchlist lu bro\\!`, { parse_mode: 'MarkdownV2' });
        }
        watchlists[userId].push(ticker);
        saveWatchlists();
        return ctx.reply(`✅ *${escapeMarkdown(ticker)}* added to watchlist\\!`, { parse_mode: 'MarkdownV2' });
    }

    // REMOVE
    if (action === 'remove' && ticker) {
        watchlists[userId] = watchlists[userId].filter(t => t !== ticker);
        saveWatchlists();
        return ctx.reply(`🗑️ *${escapeMarkdown(ticker)}* removed\\!`, { parse_mode: 'MarkdownV2' });
    }

    // VIEW - Show all watchlist stocks
    if (watchlists[userId].length === 0) {
        return ctx.reply(
            `📋 *Watchlist kosong bro\\!*\n\nTambah: \`/watchlist add BBCA\`\nHapus: \`/watchlist remove BBCA\``,
            { parse_mode: 'MarkdownV2' }
        );
    }

    try {
        const statusMsg = await ctx.reply(`📋 *Loading watchlist*\\.\\.\\. ⏳`, { parse_mode: 'MarkdownV2' });

        const results = await Promise.all(
            watchlists[userId].map(async (ticker) => {
                try {
                    const q = await getRealtimeQuote(`${ticker}.JK`);
                    return { ticker, ...q };
                } catch (e) { return { ticker, c: 0, dp: 0 }; }
            })
        );

        let msg = `📋 *YOUR WATCHLIST* 📊\n\n`;
        results.forEach((r) => {
            if (r.c > 0) {
                const icon = r.dp > 0 ? "🚀" : (r.dp < 0 ? "🔻" : "➖");
                const pct = r.dp > 0 ? `\\+${r.dp.toFixed(2)}` : `${r.dp.toFixed(2)}`;
                const cleanTicker = r.ticker.replace('.JK', '');

                msg += `• *[${escapeMarkdown(r.ticker)}](https://stockbit.com/symbol/${cleanTicker})*: ${escapeMarkdown(r.c.toString())} ${icon} ${escapeMarkdown(pct)}%\n`;
                if (r.cached) {
                    msg += `  _\\(cached ${formatTime(r.cachedTime)}\\)_ ❄️\n`;
                }
            } else {
                msg += `💤 *${escapeMarkdown(r.ticker)}*: Market closed\n`;
            }
        });
        msg += `\n_Total: ${results.length} stocks_\n`;
        msg += `\nAdd: \`/watchlist add GOTO\`\nRemove: \`/watchlist remove GOTO\``;

        await ctx.telegram.editMessageText(
            ctx.chat.id,
            statusMsg.message_id,
            null,
            msg,
            { parse_mode: 'MarkdownV2' }
        );
        console.log(chalk.blue(`📋 Watchlist sent to ${userId}`));
    } catch (e) {
        console.error(chalk.red(e));
        ctx.reply("❌ Error load watchlist\\!", { parse_mode: 'MarkdownV2' });
    }
});

bot.command('subscribe', (ctx) => {
    const userId = ctx.chat.id;
    if (!subscribers.includes(userId)) {
        subscribers.push(userId);
        saveSubscribers();
        ctx.reply("✅ *NOTIF ON\\!* 🔔", { parse_mode: 'MarkdownV2' });
        console.log(chalk.green(`🔔 ${userId} sub`));
    } else {
        ctx.reply("Udah subscribe bro 😎");
    }
});

bot.command('unsubscribe', (ctx) => {
    subscribers = subscribers.filter(id => id !== ctx.chat.id);
    saveSubscribers();
    ctx.reply("🔕 *OFF*\\.", { parse_mode: 'MarkdownV2' });
});

// BPJS - AI Powered Recommendations (Beli Pagi Jual Sore)
bot.command('bpjs', async (ctx) => {
    const statusMsg = await ctx.reply(
        `🌅 *BPJS SCANNER AKTIF*\n_Mencari momentum stocks_\n_This takes \\~1 minute_`,
        { parse_mode: 'MarkdownV2' }
    );

    try {
        // Step 1: Scan all stocks
        const results = [];
        const batchSize = 12; // Speed up

        for (let i = 0; i < getStocksToScan().length; i += batchSize) {
            const batch = getStocksToScan().slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(async (ticker) => {
                    try {
                        const q = await getRealtimeQuote(`${ticker}.JK`);
                        return { ticker, ...q };
                    } catch (e) { return null; }
                })
            );
            results.push(...batchResults.filter(r => r));
            if (i + batchSize < getStocksToScan().length) {
                await new Promise(r => setTimeout(r, 100));
            }
        }

        // Step 2: Filter BPJS criteria (momentum + positive change)
        const candidates = results
            .filter(r => r.dp > 1.5 && r.dp < 10) // Sweet spot: 1.5%-10% gain
            .sort((a, b) => b.dp - a.dp)
            .slice(0, 5); // Top 5

        if (candidates.length === 0) {
            return ctx.telegram.editMessageText(
                ctx.chat.id, statusMsg.message_id, null,
                `😴 *No BPJS opportunities found*\n\n_Market lagi flat bro\\. Try /trending_`,
                { parse_mode: 'MarkdownV2' }
            );
        }

        // Step 3: Format response (simplified - no AI analysis to avoid timeouts)
        let finalMsg = `🌅 *TOP ${candidates.length} BPJS PICKS* 🚀\n_Momentum stocks detected_\n\n`;

        candidates.forEach((stock, i) => {
            const icon = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i];
            const momentum = stock.dp > 5 ? 'STRONG' : stock.dp > 3 ? 'GOOD' : 'OK';
            const cleanTicker = stock.ticker.replace('.JK', '');

            finalMsg += `${icon} *[${escapeMarkdown(stock.ticker)}](https://stockbit.com/symbol/${cleanTicker})*\n`;
            finalMsg += `   Price: ${escapeMarkdown(stock.c.toString())} \\(${escapeMarkdown(stock.dp > 0 ? '+' + stock.dp.toFixed(2) : stock.dp.toFixed(2))}%\\)\n`;
            finalMsg += `   Momentum: ${momentum} 🔥\n\n`;
        });

        finalMsg += `_Scanned ${results.length} stocks\\. Use /analisis \\<kode\\> for AI analysis_`;

        await ctx.telegram.editMessageText(
            ctx.chat.id, statusMsg.message_id, null,
            finalMsg,
            { parse_mode: 'MarkdownV2' }
        );

        console.log(chalk.green.bold(`✅ BPJS: ${candidates.length} picks sent`));
    } catch (e) {
        console.error(chalk.red(e));
        ctx.reply("❌ Error during BPJS scan\\!", { parse_mode: 'MarkdownV2' });
    }
});

// BSJP - AI Powered Recommendations (Beli Sore Jual Pagi)
bot.command('bsjp', async (ctx) => {
    const statusMsg = await ctx.reply(
        `🌙 *BSJP SCANNER AKTIF*\n_Mencari oversold gems_\n_This takes \\~1 minute_`,
        { parse_mode: 'MarkdownV2' }
    );

    try {
        // Step 1: Scan all stocks
        const results = [];
        const batchSize = 12; // Speed up

        for (let i = 0; i < getStocksToScan().length; i += batchSize) {
            const batch = getStocksToScan().slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(async (ticker) => {
                    try {
                        const q = await getRealtimeQuote(`${ticker}.JK`);
                        return { ticker, ...q };
                    } catch (e) { return null; }
                })
            );
            results.push(...batchResults.filter(r => r));
            if (i + batchSize < getStocksToScan().length) {
                await new Promise(r => setTimeout(r, 100));
            }
        }

        // Step 2: Filter BSJP criteria (oversold but not too deep)
        const candidates = results
            .filter(r => r.dp < 0 && r.dp > -8) // Drop 0% to -8%
            .sort((a, b) => a.dp - b.dp) // Most negative first
            .slice(0, 5); // Top 5

        if (candidates.length === 0) {
            return ctx.telegram.editMessageText(
                ctx.chat.id, statusMsg.message_id, null,
                `🟢 *All stocks green today\\!*\n\n_No BSJP opportunities\\. Try /bpjs instead_`,
                { parse_mode: 'MarkdownV2' }
            );
        }

        // Step 3: Format response (simplified - no AI analysis to avoid timeouts)
        let finalMsg = `🌙 *TOP ${candidates.length} BSJP PICKS* 🎯\n_Oversold reversal candidates_\n\n`;

        candidates.forEach((stock, i) => {
            const icon = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i];
            const severity = stock.dp < -5 ? 'DEEP' : stock.dp < -3 ? 'MODERATE' : 'LIGHT';
            const cleanTicker = stock.ticker.replace('.JK', '');

            finalMsg += `${icon} *[${escapeMarkdown(stock.ticker)}](https://stockbit.com/symbol/${cleanTicker})*\n`;
            finalMsg += `   Price: ${escapeMarkdown(stock.c.toString())} \\(${escapeMarkdown(stock.dp.toFixed(2))}%\\)\n`;
            finalMsg += `   Dip: ${severity} 📉\n\n`;
        });

        finalMsg += `_Scanned ${results.length} stocks\\. Use /analisis \\<kode\\> for AI analysis_`;

        await ctx.telegram.editMessageText(
            ctx.chat.id, statusMsg.message_id, null,
            finalMsg,
            { parse_mode: 'MarkdownV2' }
        );

        console.log(chalk.green.bold(`✅ BSJP: ${candidates.length} picks sent`));
    } catch (e) {
        console.error(chalk.red(e));
        ctx.reply("❌ Error during BSJP scan\\!", { parse_mode: 'MarkdownV2' });
    }
});

// AUTO SCAN
cron.schedule('*/30 9-16 * * 1-5', async () => {
    console.log(chalk.yellow("⏰ Cron scan..."));

    try {
        const sample = getStocksToScan().sort(() => 0.5 - Math.random()).slice(0, 50);
        const potentialStocks = [];

        for (const ticker of sample) {
            try {
                const q = await getRealtimeQuote(`${ticker}.JK`);
                if (Math.abs(q.dp) > 4) potentialStocks.push({ ticker, ...q });
            } catch (e) { /* skip */ }
            await new Promise(r => setTimeout(r, 2000));
        }

        if (potentialStocks.length > 0) {
            const topAlerts = potentialStocks.sort((a, b) => Math.abs(b.dp) - Math.abs(a.dp)).slice(0, 8);
            let message = `⚠️ *ALERT\\!* ⚠️\n\n`;

            topAlerts.forEach(s => {
                const emoji = s.dp > 0 ? '🟢🚀' : '🔴📉';
                const pct = s.dp > 0 ? `\\+${s.dp.toFixed(2)}` : `${s.dp.toFixed(2)}`;
                message += `${emoji} *${escapeMarkdown(s.ticker)}* \\(${pct}%\\)\n`;
            });

            subscribers.forEach(chatId => {
                bot.telegram.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' }).catch(e => {
                    if (e.response?.error_code === 403) {
                        subscribers = subscribers.filter(id => id !== chatId);
                        saveSubscribers();
                    }
                });
            });
            console.log(chalk.green(`🚨 ${topAlerts.length} alerts`));
        }
    } catch (e) {
        console.error(chalk.red("Cron error:", e));
    }
}, { timezone: "Asia/Jakarta" });

// STARTUP
console.clear();

figlet('DAYTRADING BOT', { font: 'Slant' }, async function (err, data) {
    if (!err) console.log(chalk.cyan.bold(data));

    console.log(chalk.magenta.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.yellow.bold('🔥 Gen Z Edition - Moon or Bust 🌙'));
    console.log(chalk.green('✅ Bot ONLINE'));

    // Load stocks first
    await loadAllIDXStocks();

    console.log(chalk.cyan(`📊 Monitoring ${allIDXStocks.length} IDX stocks`));
    console.log(chalk.white(`🔔 Subscribers: ${subscribers.length}`));
    console.log(chalk.magenta.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.red.bold('\n⚠️  Tool only, not advice. DYOR!\n'));
    console.log(chalk.green.bold('🚀 Ready! /trending to scan! 💰\n'));

    bot.launch();
    console.log(chalk.cyan('Listening 👂\n'));
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
