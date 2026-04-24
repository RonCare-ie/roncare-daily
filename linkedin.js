// linkedin.js — posts today's article to LinkedIn

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ACCESS_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
const PERSON_URN   = process.env.LINKEDIN_PERSON_URN;
const SITE_URL     = process.env.SITE_URL || 'https://roncaredaily-ie.netlify.app/';

if (!ACCESS_TOKEN || !PERSON_URN) {
  console.error('Error: LINKEDIN_ACCESS_TOKEN and LINKEDIN_PERSON_URN must be set.');
  process.exit(1);
}

const dateStr = new Date().toISOString().split('T')[0];
const metaPath = path.join(__dirname, 'posts-meta.json');

if (!fs.existsSync(metaPath)) {
  console.error('No posts-meta.json found — run generate.js first.');
  process.exit(1);
}

const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
const today = meta[dateStr];

if (!today) {
  console.error(`No post found for ${dateStr}.`);
  process.exit(1);
}

const postUrl = `${SITE_URL}posts/${dateStr}.html`;
const heading = today.topicHeading;

const postHtml = fs.readFileSync(path.join(__dirname, 'posts', `${dateStr}.html`), 'utf8');
const match    = postHtml.match(/<p class="article-beginning">([\s\S]*?)<\/p>/);
const rawText  = match ? match[1].replace(/<[^>]+>/g, '') : '';
const preview  = rawText.length > 300 ? rawText.slice(0, 297) + '…' : rawText;

const shareText = `📰 RonCare Daily — ${heading}\n\n${preview}\n\nRead the full briefing → ${postUrl}`;

const body = JSON.stringify({
  author: `urn:li:person:${PERSON_URN}`,
  commentary: shareText,
  visibility: 'PUBLIC',
  distribution: {
    feedDistribution: 'MAIN_FEED',
    targetEntities: [],
    thirdPartyDistributionChannels: [],
  },
  lifecycleState: 'PUBLISHED',
  isReshareDisabledByAuthor: false,
});

const options = {
  hostname: 'api.linkedin.com',
  path: '/rest/posts',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
    'LinkedIn-Version': '202502',
    'X-Restli-Protocol-Version': '2.0.0',
    'Content-Length': Buffer.byteLength(body),
  },
};

await new Promise((resolve, reject) => {
  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log(`✓  Posted to LinkedIn (${res.statusCode})`);
        resolve();
      } else {
        console.error(`LinkedIn post failed (${res.statusCode}):`, data);
        process.exit(1);
      }
    });
  });

  req.on('error', (err) => {
    console.error('Network error:', err.message);
    reject(err);
  });

  req.write(body);
  req.end();
});
