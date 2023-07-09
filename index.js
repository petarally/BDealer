const express = require('express');
const puppeteer = require('puppeteer');
const extractProductName = require('./item');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

app.use(express.static('public'));

app.get('/', async (req, res) => {
  const given_url = 'https://www.example.com/item/einhell-ge-pm-53-2-s-hw-e-li/';
  const searchTerm = extractProductName(given_url); // Extract product name from the given URL
  const maxPrices = 10; // Maximum number of prices to collect
  const maxLinks = 30; // Maximum number of links to process in parallel
  const thresholdPercentage = 30; // Percentage threshold for filtering out unreasonable prices

  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Increase the navigation timeout to 60 seconds
  await page.setDefaultNavigationTimeout(60000);

  let priceCount = 0; // Counter for the number of prices collected
  let prices = []; // Array to store collected prices
  let currentPage = 1; // Current page counter

  while (priceCount < maxPrices) {
    const url = `https://www.google.com/search?q=${encodeURIComponent(searchTerm)}&start=${(currentPage - 1) * 10}`;

    await page.goto(url);

    const links = await page.$$eval(
      'div.g a',
      (anchors, maxLinks) => anchors.slice(0, maxLinks).map((a) => a.href),
      maxLinks
    );

    const promises = links.map((link) =>
      processLink(browser, link, page, maxPrices, priceCount, prices)
    );

    const results = await Promise.allSettled(promises);

    for (const result of results) {
      if (result.status === 'fulfilled' && priceCount >= maxPrices) {
        break; // Exit the loop if the maximum number of prices is reached
      }
    }

    currentPage++; // Increment the current page counter
  }

  await browser.close();

  const averagePrice = calculateAveragePrice(prices);
  const threshold = calculateThreshold(averagePrice, thresholdPercentage);

  const filteredPrices = filterPrices(prices, averagePrice, threshold);

  // Read HTML template file
  const htmlTemplatePath = path.join(__dirname, 'public/templates/template.html');
  const htmlTemplate = fs.readFileSync(htmlTemplatePath, 'utf-8');
  // Inject the filtered prices into the HTML template
  const html = htmlTemplate.replace('{{prices}}', generatePriceCards(filteredPrices));

  res.send(html);
});

async function processLink(browser, link, page, maxPrices, priceCount, prices) {
  const newPage = await browser.newPage();

  // Increase the navigation timeout for each new page to 60 seconds
  await newPage.setDefaultNavigationTimeout(60000);

  await newPage.goto(link);

  const priceText = await newPage.evaluate(() => {
    function formatPrice(priceText) {
      if (!priceText) {
        return '';
      }

      const decimalIndex = priceText.indexOf('.');
      if (decimalIndex !== -1) {
        const integerPart = priceText.slice(0, decimalIndex);
        const decimalPart = priceText.slice(decimalIndex + 1); // Include the decimal part
        const formattedPrice = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + decimalPart; // Add the decimal part
        return formattedPrice;
      }

      return priceText;
    }

    const euroRegex = /€|euro/i;
    const priceRegex = /[\d,.]+(?=\s*€|euro)/i;

    const priceElement = document.body.innerText;
    const priceText = priceElement ? priceElement : '';

    const priceMatch = priceText.match(priceRegex);
    let price = '';

    if (priceMatch) {
      price = formatPrice(priceMatch[0].replace(/[,.]/g, ',')); // Parse the number, remove commas or periods, and format the price
    }

    return price;
  });

  if (priceText) {
    console.log(`URL: ${link}`);
    console.log(`Price: ${priceText}`);
    priceCount++; // Increment the price counter
    prices.push({ link, price: Number(priceText) }); // Add the price to the array
  }

  await newPage.close();
}

function calculateAveragePrice(prices) {
  const sum = prices.reduce((total, price) => total + price.price, 0);
  return sum / prices.length;
}

function calculateThreshold(averagePrice, thresholdPercentage) {
  return averagePrice * (thresholdPercentage / 100);
}

function filterPrices(prices, averagePrice, threshold) {
  return prices.filter((price) => Math.abs(price.price - averagePrice) <= threshold);
}

function generatePriceCards(prices) {
  return prices
    .map(
      (price) => `
      <div class="card">
        <div class="link">Link: ${price.link}</div>
        <div class="price">Price: ${price.price}</div>
      </div>
    `
    )
    .join('');
}

app.listen(port, () => {
  console.log(`Server running onport ${port}`);
});
