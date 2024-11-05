const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware to parse JSON requests
app.use(express.json());
app.use(express.static('public')); // Serve static files from the public directory

// Function to fetch robots.txt
async function fetchRobotsTxt(url) {
    try {
        const response = await axios.get(`${url}/robots.txt`);
        return response.data;
    } catch (error) {
        console.error('Could not fetch robots.txt:', error.message);
        return null;
    }
}

// Function to parse robots.txt
function parseRobotsTxt(robotsTxt, userAgent) {
    const lines = robotsTxt.split('\n');
    let currentUserAgent = null;
    const rules = {};

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('User-agent:')) {
            currentUserAgent = trimmedLine.split(':')[1].trim();
            rules[currentUserAgent] = { disallow: [], allow: [] };
        } else if (currentUserAgent) {
            if (trimmedLine.startsWith('Disallow:')) {
                rules[currentUserAgent].disallow.push(trimmedLine.split(':')[1].trim());
            } else if (trimmedLine.startsWith('Allow:')) {
                rules[currentUserAgent].allow.push(trimmedLine.split(':')[1].trim());
            }
        }
    }

    return rules[userAgent] || rules['*'];
}

// Function to check scraping permissions
async function isScrapingAllowed(url, userAgent) {
    const robotsTxt = await fetchRobotsTxt(url);
    if (!robotsTxt) return false;

    const rules = parseRobotsTxt(robotsTxt, userAgent);
    
    // Check disallowed paths
    for (const disallowed of rules.disallow) {
        if (url.includes(disallowed)) return false;
    }

    return true; // URL is allowed
}

// Function to scrape the page
async function scrapePage(url) {
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        
        // Example: Extract all text from paragraphs
        const scrapedData = [];
        $('p').each((index, element) => {
            scrapedData.push($(element).text());
        });

        return scrapedData.join('\n');
    } catch (error) {
        console.error('Error scraping the page:', error.message);
        return null;
    }
}

// Endpoint to handle scraping requests
app.post('/scrape', async (req, res) => {
    const { url } = req.body;

    // Validate URL input
    if (!url || !url.startsWith('http://') && !url.startsWith('https://')) {
        return res.json({ success: false, message: 'Please provide a valid URL starting with http:// or https://' });
    }

    const allowed = await isScrapingAllowed(url, '*');
    
    if (allowed) {
        const scrapedContent = await scrapePage(url);
        res.json({ success: true, content: scrapedContent || 'No content found.' });
    } else {
        res.json({ success: false, message: 'Scraping not allowed for this URL.' });
    }
});

// Serve the index.html file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
