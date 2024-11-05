const axios = require('axios');
const cheerio = require('cheerio');
const readline = require('readline');

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

// CLI setup using readline for user input
function startCli() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('Enter the URL to scrape: ', async (urlInput) => {
        const allowed = await isScrapingAllowed(urlInput, '*');
        
        if (allowed) {
            const scrapedContent = await scrapePage(urlInput);
            console.log(scrapedContent || 'No content found.');
        } else {
            console.log('Scraping not allowed for this URL.');
        }
        
        rl.close();
    });
}

// Export the scraping functions for web usage
module.exports = {
    isScrapingAllowed,
    scrapePage,
    startCli
};

// If this file is executed directly, start the CLI
if (require.main === module) {
    startCli();
}
