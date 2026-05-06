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

// ─── Topics ────────────────────────────────────────────────────────────────

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
    prompt: `Using web search, find recent news, practical resources, and supportive guidance from today or the past 72 hours related to unpaid family carers in Europe, particularly in Ireland and the UK.

Write a structured news article with the following three parts:

BEGINNING — One paragraph that sets the scene: what is the current situation for family carers, and what recent development brings this into focus today?

MIDDLE — Two or three paragraphs covering practical information or resources that would genuinely help someone caring for a loved one. Cover things like financial entitlements, mental health support, respite care, advocacy news, or community initiatives. Be specific and empathetic.

END — One paragraph that closes with warmth and a clear takeaway: one concrete thing a carer reading this could do or be aware of.

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

  const reviewPrompt = `You are an editor for RonCare Daily, a newsletter for family carers. Review the article draft below and fix any issues before it is published.

Check for and correct:
1. AI-sounding filler phrases ("It's worth noting", "It's important to highlight", "In conclusion", "Furthermore", "Delve into", "Comprehensive", "Facilitate", "Underscore", "Navigate") — rewrite naturally.
2. Paragraphs that are too long (more than 4 sentences) — split them.
3. Stiff, cold, or corporate tone — make it warmer and more human.
4. Any factual inconsistencies within the article itself (e.g. a statistic mentioned twice with different values, contradictory statements).
5. Repetitive sentence structures or words used too close together.

Do NOT add new facts, change real names or statistics, or add content that wasn't in the original. Only improve the writing quality and fix errors.

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
    model: 'claude-sonnet-4-6',
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
  <meta name="description" content="RonCare Daily briefing for ${formattedDate}. AI in healthcare, the ageing crisis, and support for family carers.">
  <meta property="og:title" content="RonCare Daily — ${formattedDate}">
  <meta property="og:type" content="article">
  <link rel="stylesheet" href="../styles.css">
</head>
<body>
  <header>
    <div class="container">
      <div>
        <a href="../index.html" class="site-name">RonCare Daily</a>
        <p class="tagline">For those who care.</p>
      </div>
      <img src="../icon.png" alt="RonCare" class="header-icon">
    </div>
  </header>

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
  <meta name="description" content="A free briefing for family carers every Monday, Wednesday, Friday and Sunday. Covering AI in healthcare, the ageing population crisis, and practical support resources for carers across Europe.">
  <meta property="og:title" content="RonCare Daily — News &amp; Resources for Family Carers">
  <meta property="og:type" content="website">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header>
    <div class="container">
      <div>
        <span class="site-name">RonCare Daily</span>
        <p class="tagline">For those who care.</p>
      </div>
      <img src="icon.png" alt="RonCare" class="header-icon">
    </div>
  </header>

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

  console.log(`\nRonCare Daily — ${dateStr}`);
  console.log(`Generating all 3 sections...\n`);

  const postsDir = path.join(__dirname, 'posts');
  if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir, { recursive: true });

  const postPath = path.join(postsDir, `${dateStr}.html`);
  if (fs.existsSync(postPath) && !process.argv.includes('--force')) {
    console.log(`Today's post already exists. Run with --force to regenerate.`);
    return;
  }

  // Generate all three sections sequentially (web search tool requires sequential calls)
  const sections = [];
  for (const topic of TOPICS) {
    const draft   = await generateArticle(topic);
    const content = await reviewArticle(topic, draft);
    sections.push({ topic, content });
    if (sections.length < TOPICS.length) {
      console.log('  ⏳ Pausing 60s to stay within rate limits...');
      await new Promise(r => setTimeout(r, 60000));
    }
  }

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
  console.log('✓  index.html updated\n');
}

main().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
