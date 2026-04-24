// linkedin.js — posts today's article to LinkedIn

import fs from 'fs';
import path from 'path';
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

const postUrl  = `${SITE_URL}posts/${dateStr}.html`;
const heading  = today.topicHeading;

// Extract beginning paragraph from the post HTML
const postHtml = fs.readFileSync(path.join(__dirname, 'posts', `${dateStr}.html`), 'utf8');
const match    = postHtml.match(/<p class="article-beginning">([\s\S]*?)<\/p>/);
const rawText  = match ? match[1].replace(/<[^>]+>/g, '') : '';
const preview  = rawText.length > 300 ? rawText.slice(0, 297) + '…' : rawText;

const shareText = `📰 RonCare Daily — ${heading}\n\n${preview}\n\nRead the full briefing →`;

const body = {
  author: `urn:li:person:${PERSON_URN}`,
  lifecycleState: 'PUBLISHED',
  specificContent: {
    'com.linkedin.ugc.ShareContent': {
      shareCommentary: { text: shareText },
      shareMediaCategory: 'ARTICLE',
      media: [{
        status: 'READY',
        originalUrl: postUrl,
        title: { text: `RonCare Daily — ${heading}` },
        description: { text: preview },
      }],
    },
  },
  visibility: {
    'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
  },
};

const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
    'X-Restli-Protocol-Version': '2.0.0',
  },
  body: JSON.stringify(body),
});

const data = await res.json();

if (res.ok) {
  console.log(`✓  Posted to LinkedIn: ${data.id}`);
} else {
  console.error('LinkedIn post failed:', JSON.stringify(data, null, 2));
  process.exit(1);
}
