# 🚀 Day Trading Bot

**Moon or Bust!** 🌙💰

This is a powerful, AI-driven Telegram bot designed for the Indonesian Stock Exchange (IDX/BEI). It combines real-time data scraping, technical analysis (RSI, MACD, SMA), and Generative AI (Llama-3 via Groq) to provide actionable trading insights with a "Gen Z" personality.

![Bot Banner](https://img.shields.io/badge/Status-ONLINE-success?style=for-the-badge) ![Tech-Stack](https://img.shields.io/badge/Node.js-v.22-green?style=for-the-badge)

## ✨ Features

- **🤖 AI Analyst**: "Hafischz" - a sharp, slang-using AI trader that gives recommendations (GASPOL BELI 🚀, TUNGGU DIP 🟡, DLL) with targets (TP/SL).
- **📊 Real-time Data**: Accurate prices via Google Finance scraping (bypassing expensive API limits).
- **📈 Technicals**: Auto-calculates RSI (14), SMA (20), MACD, and Signal lines.
- **⚡ Scanners**:
  - `/bpjs`: **B**eli **P**agi **J**ual **S**ore (Momentum/Breakout scanner).
  - `/bsjp`: **B**eli **S**ore **J**ual **P**agi (Oversold/Dip scanner).
  - `/trending`: Fast scans of 122+ liquid stocks.
- **🔔 Smart Alerts**: Auto-monitors the market for huge pumps/dumps (>4%).
- **📱 Telegram Integration**: Interactive and fast response.

## 🛠 Tech Stack

- **Runtime**: Node.js
- **Framework**: Telegraf.js
- **AI**: Groq SDK (Llama-3.3-70b)
- **Data**: Google Finance (Cheerio Scraper) + Yahoo Finance (Historical/Chart) + Finnhub (Alternative)
- **Utilities**: Chalk (Logs), Cron (Scheduling), Figlet (Banner)

## 🚀 Installation

1.  **Clone the repo**
    ```bash
    git clone https://github.com/hafisc/day-trading-bot.git
    cd day-trading-bot
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment**
    Create a `.env` file in the root directory:
    ```env
    TELEGRAM_TOKEN=your_telegram_bot_token
    FINNHUB_API_KEY=your_finnhub_key
    GROQ_API_KEY=your_groq_api_key
    ```

4.  **Run the Bot**
    ```bash
    node index.js
    ```

## 🎮 Commands

| Command | Description |
| :--- | :--- |
| `/price <CODE>` | Cek harga real-time (e.g., `/price BBCA`) |
| `/analisis <CODE>` | Minta AI analisa teknikal & fundamental |
| `/bpjs` | Scan saham momentum (Buy on Strength) |
| `/bsjp` | Scan saham oversold (Buy on Weakness) |
| `/trending` | Scan saham top liquid |
| `/watchlists` | Lihat daftar pantauan |
| `/subscribe` | Subscribe notifikasi alert (Pump/Dump) |

## 📂 Project Structure

```
├── .env                # Config (IGNORED by Git)
├── .gitignore          # Git ignore rules
├── index.js            # Main Logic
├── data/
│   ├── idx_liquid.js   # List of 122 Liquid Stocks
│   └── idx_stocks_comprehensive.js # Full IDX List
├── package.json        # Dependencies
└── README.md           # Documentation
```

## ⚠️ Disclaimer

**DYOR (Do Your Own Research)!**
Bot ini hanyalah **alat bantu (tool)**. Segala keputusan jual/beli adalah tanggung jawab masing-masing trader. Developer tidak bertanggung jawab atas kerugian finansial.

---
*Built with code & caffeine by [Hafisc](https://github.com/hafisc)*
