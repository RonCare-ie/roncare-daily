// RonCare Daily — generate.js

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Shared writing guidelines ─────────────────────────────────────────────

const WRITING_GUIDELINES = `
Writing guidelines — follow these carefully:
- Tone: warm, friendly, and human. Write as if talking to a friend who cares for a loved one. Avoid clinical or corporate language.
- Length: each paragraph should be 3–4 sentences maximum. Keep it readable and engaging — people should finish the article, not feel overwhelmed.
- Avoid AI filler phrases like "It's worth noting", "It's important to highlight", "In conclusion", "Furthermore", "Delve into", "Comprehensive", or "Facilitate". Write naturally.
- Be specific and factual — include real names, organisations, and figures. Do not invent or estimate statistics.
- Use plain English. Short sentences. Active voice where possible.
`;

// ─── Step 0: Discover today's fresh headings via web search ───────────────

async function discoverTopics() {
  console.log('  → Discovering today\'s news topics...');

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{
      role: 'user',
      content: `Using web search, find the most relevant news stories from today or the past 24–48 hours across these three care-related areas:
1. AI or technology in healthcare administration or care coordination
2. Population ageing, elderly care policy, or care system pressures in Europe/UK/Ireland
3. Support, resources, or news for unpaid family carers in Ireland or the UK

For each area, return a specific, newsworthy article heading and a one-sentence tagline based on what is actually in the news today — not generic titles.

Return ONLY valid JSON, no other text:
{
  "topics": [
    {"id": "ai-healthcare", "heading": "Specific headline based on today's news", "tagline": "One sentence tagline"},
    {"id": "ageing-crisis", "heading": "Specific headline based on today's news", "tagline": "One sentence tagline"},
    {"id": "carer-resources", "heading": "Specific headline based on today's news", "tagline": "One sentence tagline"},
    {"id": "roncare-spotlight", "heading": "A compelling human-interest headline about Irish family carers", "tagline": "One sentence tagline"}
  ]
}`,
    }],
  });

  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.topics && parsed.topics.length === 4) {
        console.log('  ✓ Fresh topics discovered');
        return parsed.topics;
      }
    }
  } catch { /* fall through */ }
  console.warn('  ⚠ Could not parse topics — using default headings');
  return null;
}

// ─── RonCare verified facts (sourced from internal research doc) ─────────────

const RONCARE_FACTS = `
VERIFIED IRISH CARER STATISTICS (sourced from RonCare research, 2019–2025):

Population & scale:
- 500,000+ people in Ireland provide unpaid family care; Census 2022 recorded 299,000 self-identified carers, up 53% since 2016
- 14% of Irish population identifies as a carer (2024), up from 9% in 2019
- Those aged 45–54 are most likely to be caring (23%)
- Ireland has the fastest-ageing population in Europe; 65+ population grew 37% since 2015, projected to double by 2051
- Family carers save the State an estimated €20 billion per year

The hours & toll:
- Average carer provides 38.7 hours of care per week — a full-time job without pay
- 29% provide 43+ hours per week (up from 21% in 2016)
- 67% of Irish carers have been diagnosed or treated for a physical health condition; 40% have a back injury from caring
- 48% of Irish family carers diagnosed with a mental health condition; 35% with depression, 39% with anxiety
- 72% of family carers have never accessed respite care
- 44% of carers experience physical or emotional harm as part of their caring role

Entitlements (what carers often don't know):
- Carer's Allowance: ~€270/week, means-tested; you can work up to 18.5 hours/week and still qualify
- Income disregard increasing to €1,000/week (single) and €2,000/week (couple) from July 2026 — far more people will qualify
- Carer's Benefit: PRSI-based, not means-tested; extended to self-employed from January 2025; payable up to 104 weeks
- Carer's Support Grant: €2,000 tax-free annual payment, paid automatically each June
- Additional: Free Travel Pass, Household Benefits Package, Free GP Visit Card, Fuel Allowance
- Carer's Leave: up to 104 weeks unpaid leave; employer must keep your job open
- Apply via: citizensinformation.ie or welfare.ie (form CR1)

The sandwich generation:
- People aged 50–59 are the group most likely to be providing regular care in Ireland
- Ireland's old-age dependency ratio projected to reach 50 by 2057 (one older person per two working-age adults)
- Up to 13% of Irish adolescents and young adults are also carers — most don't tell anyone
- Young carers are 3.6 times more likely to be depressed than their peers

HSE & system:
- 23.76 million hours of home support delivered in 2024 (12.5% increase since 2022)
- Home support budget up 70% between 2020 and 2024
- 5,556 people currently on the waiting list for home care
- 50%+ of nurses in Ireland are foreign-trained (OECD 2024)
- In March 2025, Ireland added 1,000 General Employment Permits specifically for care workers

Gender gap:
- 34% of women do most or all of care for their main recipient, vs 19% of men
- 80% of long-term care across the EU is provided informally, majority by women
- Economic cost of gender care gap: €147–220 billion per year across Europe

After caring:
- 20% of bereaved carers develop complicated grief, persistent depression, or significant psychiatric symptoms
- Many carers lose their sense of identity and purpose after the person they cared for dies
- Depressive symptoms typically peak within 3 months of bereavement but can take 15+ months to return to baseline
`;

// ─── Topics (fallback defaults) ────────────────────────────────────────────

const TOPICS = [
  {
    id: 'ai-healthcare',
    heading: 'AI in Healthcare Administration',
    tagline: 'How artificial intelligence is reshaping the coordination and administration of care services',
    prompt: `Using web search, find the latest news from today or the past 48 hours about practical applications of AI in healthcare administration and coordination.

Write a structured news article with the following three parts:

BEGINNING — One paragraph that sets the scene: what is happening right now in this space and why it matters today.

MIDDLE — Two or three paragraphs covering the key recent developments. Be specific — include organisation names, countries, statistics, and real-world examples. Each paragraph covers a distinct development.

END — One paragraph that draws it together: what does this mean going forward?

Then list 2–4 source links you found.
${WRITING_GUIDELINES}
Return ONLY valid JSON in this exact format, with no other text:
{
  "beginning": "Opening paragraph as a string.",
  "middle": ["First body paragraph.", "Second body paragraph.", "Third body paragraph (optional)."],
  "end": "Closing paragraph as a string.",
  "links": [
    {"title": "Full article title", "url": "https://actual-url.com/article"}
  ]
}`,
  },
  {
    id: 'ageing-crisis',
    heading: 'The Population Ageing Crisis',
    tagline: "The growing pressure on health and social care systems as Europe's population ages",
    prompt: `Using web search, find the latest news from today or the past 48–72 hours about the population ageing crisis and its impact on health and social care systems, particularly in Europe, the UK, or Ireland.

Write a structured news article with the following three parts:

BEGINNING — One paragraph that sets the scene: what is happening right now and why it matters today.

MIDDLE — Two or three paragraphs covering the key recent developments. Include policy responses, funding figures, workforce data, or reform proposals. Be specific with countries, statistics, and named organisations.

END — One paragraph that draws it together: what does this mean for families, carers, and policymakers?

Then list 2–4 source links you found.
${WRITING_GUIDELINES}
Return ONLY valid JSON in this exact format, with no other text:
{
  "beginning": "Opening paragraph as a string.",
  "middle": ["First body paragraph.", "Second body paragraph.", "Third body paragraph (optional)."],
  "end": "Closing paragraph as a string.",
  "links": [
    {"title": "Full article title", "url": "https://actual-url.com/article"}
  ]
}`,
  },
  {
    id: 'carer-resources',
    heading: 'Support & Community for Family Carers',
    tagline: 'Resources, guidance, and solidarity for those caring for a loved one across Europe',
    prompt: `Using web search, find recent news, practical resources, and supportive guidance from today or the past 72 hours related to unpaid family carers in Ireland and the UK.

This article must be specifically useful to family carers in Ireland. Address at least one of the following real questions Irish carers search for:
- How much does a full time carer cost in Ireland?
- What is the carer's allowance in Ireland and what is the current rate?
- Can my mum pay me to look after her?
- What is the HSE home care package and who is entitled to it?
- What can carers get for free in Ireland?
- How much does an overnight carer cost in Ireland?
- What is the carer's support grant?
- How much money can you have in the bank and still get carer's allowance?
- Do dementia patients do better at home or in a nursing home?
- How to apply for home help in Ireland?

Write a structured news article with the following three parts:

BEGINNING — One paragraph that sets the scene: what is the current situation for family carers in Ireland, and what recent development brings this into focus today?

MIDDLE — Two or three paragraphs covering practical information or entitlements that would genuinely help someone caring for a loved one in Ireland. Be specific: include figures, HSE/Citizens Information links, and real-world examples.

END — One paragraph that closes with warmth and a clear takeaway: one concrete thing an Irish carer reading this could do today.

Then list 2–4 source links you found.
${WRITING_GUIDELINES}
Return ONLY valid JSON in this exact format, with no other text:
{
  "beginning": "Opening paragraph as a string.",
  "middle": ["First body paragraph.", "Second body paragraph.", "Third body paragraph (optional)."],
  "end": "Closing paragraph as a string.",
  "links": [
    {"title": "Full article title", "url": "https://actual-url.com/article"}
  ]
}`,
  },
  {
    id: 'roncare-spotlight',
    heading: 'The RonCare Spotlight',
    tagline: 'Real facts, real people — shining a light on the hidden world of family caring in Ireland',
    prompt: `You are writing for RonCare Daily, a blog for family carers in Ireland run by RonCare (roncare.ie) — a care coordination app built for families managing care at home.

Using the verified Irish carer statistics below, write an article that shines a light on ONE of these angles — choose whichever feels most timely, relevant, or underreported:
- The sandwich generation (people caring for elderly parents while raising their own children)
- What carers are actually entitled to in Ireland (most don't know)
- The mental health toll of caring
- The physical toll of caring
- Young carers in Ireland (up to 13% of adolescents)
- Life after caring — what happens when the person you cared for passes away
- The gender care gap in Ireland and Europe
- The scale of home care and why the system is under pressure
- The €20 billion unpaid carers save the Irish State every year

VERIFIED FACTS TO DRAW FROM:
${RONCARE_FACTS}

Write a structured article with the following three parts:

BEGINNING — One paragraph that opens with a striking fact or human truth from the stats above. Make it personal and real.

MIDDLE — Two or three paragraphs that go deeper into the chosen angle. Use the specific figures above — don't search the web, use what's provided. Explain what it means for real families in Ireland.

END — One warm, practical closing paragraph. Mention RonCare naturally (not as an ad — as a tool that exists for exactly this reason). Link to roncare.ie.

Do NOT include source links — the facts are already verified.
${WRITING_GUIDELINES}
Return ONLY valid JSON in this exact format, with no other text:
{
  "beginning": "Opening paragraph as a string.",
  "middle": ["First body paragraph.", "Second body paragraph.", "Third body paragraph (optional)."],
  "end": "Closing paragraph as a string.",
  "links": []
}`,
  },
];

// ─── Parse JSON from API response ──────────────────────────────────────────

function parseContent(text) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        beginning: String(parsed.beginning || '').trim(),
        middle:    Array.isArray(parsed.middle) ? parsed.middle.map(p => String(p).trim()) : [],
        end:       String(parsed.end || '').trim(),
        links:     Array.isArray(parsed.links) ? parsed.links.filter(l => l.title && l.url) : [],
      };
    }
  } catch {
    // fall through
  }
  return null;
}

// ─── Step 1: Generate one section with web search ─────────────────────────

async function generateArticle(topic) {
  console.log(`  → Generating: ${topic.heading}...`);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{ role: 'user', content: topic.prompt }],
  });

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  const parsed = parseContent(text);
  if (parsed) return parsed;

  console.warn(`  ⚠  Could not parse JSON for "${topic.heading}" — using raw text`);
  return { beginning: text.trim(), middle: [], end: '', links: [] };
}

// ─── Step 2: Review and fix one section before publishing ─────────────────

async function reviewArticle(topic, content) {
  console.log(`  → Reviewing: ${topic.heading}...`);

  const draft = JSON.stringify(content, null, 2);

  const reviewPrompt = `You are an editor for RonCare Daily, a newsletter for family carers in Ireland. Review the article draft below and fix any issues before it is published.

FACT-CHECKING (most important — do these first):
1. Every statistic must have a named source (e.g. "Family Carers Ireland", "HSE", "Citizens Information", "CSO"). If a stat has no source, remove it.
2. Remove any figure that seems invented, estimated, or vague (e.g. "studies show", "experts say", "many carers"). Only keep what can be traced to a real organisation.
3. Check that no two statistics in the article contradict each other.
4. Source links must be real, specific URLs — not homepages. If a link looks generic or invented, remove it.
5. Irish-specific content only: remove any statistics that are not from Ireland, the UK, or the EU. Do not mix in US figures.

WRITING QUALITY:
6. Remove AI filler phrases: "It's worth noting", "It's important to highlight", "In conclusion", "Furthermore", "Delve into", "Comprehensive", "Facilitate", "Underscore", "Navigate" — rewrite naturally.
7. Split any paragraph longer than 4 sentences.
8. Warm, human tone — write as if talking to a friend, not publishing a press release.
9. No repetitive sentence structures or repeated words close together.

Do NOT add new facts or change verified statistics. Only improve quality and remove unverifiable claims.

Article topic: ${topic.heading}

Draft:
${draft}

Return ONLY the corrected article as valid JSON in this exact format, with no other text:
{
  "beginning": "Corrected opening paragraph.",
  "middle": ["Corrected paragraph 1.", "Corrected paragraph 2.", "Corrected paragraph 3 (if present)."],
  "end": "Corrected closing paragraph.",
  "links": [
    {"title": "Article title", "url": "https://url.com"}
  ]
}`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{ role: 'user', content: reviewPrompt }],
  });

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  const reviewed = parseContent(text);
  if (reviewed) {
    if (reviewed.links.length === 0 && content.links.length > 0) {
      reviewed.links = content.links;
    }
    return reviewed;
  }

  console.warn(`  ⚠  Review returned unparseable content for "${topic.heading}" — keeping original draft`);
  return content;
}

// ─── HTML helpers ────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(date) {
  return date.toLocaleDateString('en-IE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function formatShortDate(date) {
  return date.toLocaleDateString('en-IE', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function sectionHTML(topic, content) {
  const middleHTML = content.middle
    .map(p => `        <p>${escapeHtml(p)}</p>`)
    .join('\n');

  const linksHTML = content.links.length > 0
    ? `\n        <div class="sources">
          <h3>Sources</h3>
          <ul>
            ${content.links.map(l =>
              `<li><a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.title)}</a></li>`
            ).join('\n            ')}
          </ul>
        </div>`
    : '';

  return `      <section class="topic-section">
        <h2>${escapeHtml(topic.heading)}</h2>
        <p class="topic-tagline">${escapeHtml(topic.tagline)}</p>
        <div class="article-body">
        <p class="article-beginning">${escapeHtml(content.beginning)}</p>
${middleHTML}
        <p class="article-end">${escapeHtml(content.end)}</p>${linksHTML}
        </div>
      </section>`;
}

// ─── Shared nav header ───────────────────────────────────────────────────────

function navHTML(iconSrc) {
  return `
  <nav style="background:#F5EDE3;border-bottom:1px solid #e0d4c4;position:sticky;top:0;z-index:50;font-family:Georgia,serif;">
    <div style="max-width:1024px;margin:0 auto;padding:0 20px;height:64px;display:flex;align-items:center;justify-content:space-between;">
      <a href="https://www.roncare.ie/" style="display:flex;align-items:center;gap:8px;text-decoration:none;">
        <img src="${iconSrc}" alt="RonCare" style="height:44px;width:44px;">
        <span style="font-size:18px;font-weight:700;color:#C15A2E;letter-spacing:0.03em;">RonCare</span>
      </a>
      <div style="display:flex;gap:32px;align-items:center;">
        <a href="https://www.roncare.ie/blog/" style="font-size:13px;font-weight:600;letter-spacing:0.1em;color:#C15A2E;text-decoration:none;text-transform:uppercase;">Blog</a>
        <a href="https://www.roncare.ie/#waitlist" style="font-size:13px;font-weight:600;letter-spacing:0.1em;color:#C15A2E;text-decoration:none;text-transform:uppercase;">Waitlist</a>
        <a href="https://www.roncare.ie/founder" style="font-size:13px;font-weight:600;letter-spacing:0.1em;color:#C15A2E;text-decoration:none;text-transform:uppercase;">Founder Intro</a>
        <a href="https://www.roncare.ie/resources" style="font-size:13px;font-weight:600;letter-spacing:0.1em;color:#C15A2E;text-decoration:none;text-transform:uppercase;">Resources</a>
      </div>
      <a href="https://www.roncare.ie/#waitlist" style="background:#C15A2E;color:#F5EDE3;padding:8px 20px;border-radius:24px;font-size:14px;font-weight:600;text-decoration:none;white-space:nowrap;">Join the Waitlist</a>
    </div>
  </nav>`;
}

// ─── Post page ───────────────────────────────────────────────────────────────

function generatePostHTML(date, sections) {
  const dateStr       = date.toISOString().split('T')[0];
  const formattedDate = formatDate(date);

  const sectionsHTML = sections
    .map(({ topic, content }) => sectionHTML(topic, content))
    .join('\n\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RonCare Daily — ${formattedDate}</title>
  <meta name="description" content="RonCare Daily briefing for ${formattedDate}. AI in healthcare, the ageing crisis, and support for family carers in Ireland.">
  <meta property="og:title" content="RonCare Daily — ${formattedDate}">
  <meta property="og:type" content="article">
  <link rel="canonical" href="https://www.roncare.ie/blog/posts/${dateStr}.html">
  <link rel="stylesheet" href="../styles.css">
</head>
<body>
${navHTML('../icon.png')}

  <main class="container">
    <article>
      <div class="post-meta">
        <time datetime="${dateStr}">${formattedDate}</time>
      </div>
${sectionsHTML}
    </article>
  </main>

  <div class="banner-wrap">
    <img src="../banner.png" alt="Ron Care Companion" class="bottom-banner">
  </div>

  <footer>
    <div class="container">
      <p>RonCare Daily publishes AI-assisted briefings every Monday, Wednesday, Friday, and Sunday. Always verify information from original sources before acting on it.</p>
      <p><a href="../index.html">← All posts</a></p>
    </div>
  </footer>
</body>
</html>`;
}

// ─── Index / homepage ────────────────────────────────────────────────────────

function generateIndexHTML(allPosts, latestSections) {
  const today         = allPosts[0];
  const formattedDate = formatDate(today.date);

  const sectionsHTML = latestSections
    .map(({ topic, content }) => sectionHTML(topic, content))
    .join('\n\n');

  const archiveHTML = allPosts.length > 1
    ? `\n  <aside class="archive">
    <div class="container">
      <h2>Previous Briefings</h2>
      <ul>
        ${allPosts.slice(1).map(p =>
          `<li><a href="posts/${p.dateStr}.html"><span class="archive-date">${formatShortDate(p.date)}</span></a></li>`
        ).join('\n        ')}
      </ul>
    </div>
  </aside>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RonCare Daily — News &amp; Resources for Family Carers</title>
  <meta name="description" content="A free briefing for family carers in Ireland every Monday, Wednesday, Friday and Sunday. Covering carer's allowance, HSE home care packages, respite care, and practical support.">
  <meta property="og:title" content="RonCare Daily — News &amp; Resources for Family Carers in Ireland">
  <meta property="og:type" content="website">
  <link rel="canonical" href="https://www.roncare.ie/blog/">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
${navHTML('icon.png')}

  <main class="container">
    <div class="post-meta">
      <time datetime="${today.dateStr}">${formattedDate}</time>
    </div>
${sectionsHTML}
  </main>
${archiveHTML}

  <footer>
    <div class="container">
      <p>RonCare Daily publishes AI-assisted briefings every Monday, Wednesday, Friday, and Sunday. Always verify information from original sources.</p>
    </div>
  </footer>
</body>
</html>`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY is not set. Add it to your .env file.');
    process.exit(1);
  }

  const today   = new Date();
  const dateStr = today.toISOString().split('T')[0];

  // Pick topic by day: Mon=AI, Wed=Ageing, Fri=Carer Resources, Sun=RonCare Spotlight
  const dayMap = { 1: 0, 3: 1, 5: 2, 0: 3 };
  const dayOfWeek = today.getUTCDay();
  const topicIndex = dayMap[dayOfWeek] ?? 0;
  const baseTopic = TOPICS[topicIndex];

  console.log(`\nRonCare Daily — ${dateStr}`);
  console.log(`Topic: ${baseTopic.heading}\n`);

  const postsDir = path.join(__dirname, 'posts');
  if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir, { recursive: true });

  const postPath = path.join(postsDir, `${dateStr}.html`);
  if (fs.existsSync(postPath) && !process.argv.includes('--force')) {
    console.log(`Today's post already exists. Run with --force to regenerate.`);
    return;
  }

  // Discover a fresh heading for today's topic
  const freshTopics = await discoverTopics();
  const topic = freshTopics
    ? { ...baseTopic, heading: freshTopics[topicIndex].heading, tagline: freshTopics[topicIndex].tagline }
    : baseTopic;
  console.log('  ⏳ Pausing 30s after topic discovery...');
  await new Promise(r => setTimeout(r, 30000));

  // Generate and review one article
  const draft   = await generateArticle(topic);
  const content = await reviewArticle(topic, draft);
  const sections = [{ topic, content }];

  // Write dated post
  fs.writeFileSync(postPath, generatePostHTML(today, sections), 'utf8');
  console.log(`\n✓  Post written: posts/${dateStr}.html`);

  // Update archive index
  const metaPath = path.join(__dirname, 'posts-meta.json');
  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {};
  meta[dateStr] = {};
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');

  const allPosts = Object.entries(meta)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([ds]) => ({
      dateStr: ds,
      date: new Date(ds + 'T07:00:00'),
    }));

  fs.writeFileSync(
    path.join(__dirname, 'index.html'),
    generateIndexHTML(allPosts, sections),
    'utf8',
  );
  console.log('✓  index.html updated');

  // Generate sitemap
  const sitemapUrls = [
    `  <url>\n    <loc>https://www.roncare.ie/blog/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`,
    ...allPosts.map(p =>
      `  <url>\n    <loc>https://www.roncare.ie/blog/posts/${p.dateStr}.html</loc>\n    <lastmod>${p.dateStr}</lastmod>\n    <changefreq>never</changefreq>\n    <priority>0.8</priority>\n  </url>`
    ),
  ].join('\n');
  const sitemapXML = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls}\n</urlset>`;
  fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), sitemapXML, 'utf8');
  console.log('✓  sitemap.xml updated\n');
}

main().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
