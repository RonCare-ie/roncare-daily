// RonCare Daily — generate.js
// Fetches today's news across three topics using Anthropic AI + web search,
// then writes a dated HTML post and updates index.html.

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Topics ────────────────────────────────────────────────────────────────

const TOPICS = [
  {
    id: 'ai-healthcare',
    heading: 'AI in Healthcare Administration',
    tagline: 'How artificial intelligence is reshaping the coordination and administration of care services',
    prompt: `Using web search, find the latest news from today or the past 48 hours about practical applications of AI in healthcare administration and coordination. Look for real-world implementations such as AI scheduling tools in hospitals, patient coordination systems, automated administrative workflows, AI in NHS or European health services, or care coordination software. Write a 5–7 sentence summary covering the most important recent developments. Be specific — include organisation names, countries, or figures where relevant. Then list 2–4 source links you found.

Return ONLY valid JSON in this exact format, with no other text:
{
  "summary": "Your 5-7 sentence summary here as a single paragraph string.",
  "links": [
    {"title": "Full article title", "url": "https://actual-url.com/article"},
    {"title": "Another article title", "url": "https://another-url.com/story"}
  ]
}`,
  },
  {
    id: 'ageing-crisis',
    heading: 'The Population Ageing Crisis',
    tagline: "The growing pressure on health and social care systems as Europe's population ages",
    prompt: `Using web search, find recent news from today or the past 48–72 hours about the population ageing crisis and its impact on health and social care systems, particularly in Europe, the UK, or Ireland. Look for news about policy responses, funding challenges, social care workforce shortages, reform proposals, eldercare system pressures, or new statistics on ageing demographics. Write a 5–7 sentence summary of the key recent developments. Be specific with details, statistics, and countries. Then list 2–4 source links.

Return ONLY valid JSON in this exact format, with no other text:
{
  "summary": "Your 5-7 sentence summary here as a single paragraph string.",
  "links": [
    {"title": "Full article title", "url": "https://actual-url.com/article"},
    {"title": "Another article title", "url": "https://another-url.com/story"}
  ]
}`,
  },
  {
    id: 'carer-resources',
    heading: 'Support & Community for Family Carers',
    tagline: 'Resources, guidance, and solidarity for those caring for a loved one across Europe',
    prompt: `Using web search, find recent news, practical resources, and supportive guidance from today or the past 72 hours related to unpaid family carers in Europe, particularly in Ireland and the UK. Look for information on carer burnout, mental health support, financial entitlements for carers, respite care options, carer advocacy, support organisations, or community stories from people caring for elderly or ill family members. Write a 5–7 sentence summary with an empathetic, practical tone — focus on information that would genuinely help someone who is currently caring for a loved one. Then list 2–4 source links.

Return ONLY valid JSON in this exact format, with no other text:
{
  "summary": "Your 5-7 sentence summary here as a single paragraph string.",
  "links": [
    {"title": "Full article title", "url": "https://actual-url.com/article"},
    {"title": "Another article title", "url": "https://another-url.com/story"}
  ]
}`,
  },
];

// ─── Anthropic API call ─────────────────────────────────────────────────────

async function generateTopicContent(topic) {
  console.log(`  → ${topic.heading}...`);

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

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summary: String(parsed.summary || text).trim(),
        links: Array.isArray(parsed.links) ? parsed.links.filter(l => l.title && l.url) : [],
      };
    }
  } catch {
    console.warn(`  ⚠  Could not parse JSON for "${topic.heading}" — using raw text`);
  }

  return { summary: text.trim(), links: [] };
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

function topicSectionHTML(topic, content, pathPrefix = '') {
  const paragraphs = content.summary
    .split(/\n+/)
    .filter(p => p.trim())
    .map(p => `        <p>${escapeHtml(p.trim())}</p>`)
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

  return `    <section class="topic" id="${topic.id}">
      <h2>${escapeHtml(topic.heading)}</h2>
      <p class="topic-tagline">${escapeHtml(topic.tagline)}</p>
      <div class="summary">
${paragraphs}
      </div>${linksHTML}
    </section>`;
}

// ─── Post page ───────────────────────────────────────────────────────────────

function generatePostHTML(date, sections) {
  const dateStr       = date.toISOString().split('T')[0];
  const formattedDate = formatDate(date);

  const sectionsHTML = sections
    .map(({ topic, content }) => topicSectionHTML(topic, content))
    .join('\n\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RonCare Daily — ${formattedDate}</title>
  <meta name="description" content="Daily briefing for family carers: AI in healthcare, the ageing population crisis, and carer support resources. ${formattedDate}.">
  <meta name="keywords" content="family carers, carer support, AI in healthcare, ageing population, elderly care Ireland, carer burnout, social care Europe, caring for parents, carer resources">
  <meta property="og:title" content="RonCare Daily — ${formattedDate}">
  <meta property="og:description" content="A daily briefing on AI in healthcare, the ageing crisis, and practical resources for family carers.">
  <meta property="og:type" content="article">
  <link rel="stylesheet" href="../styles.css">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "RonCare Daily — ${formattedDate}",
    "datePublished": "${dateStr}T07:00:00",
    "author": {"@type": "Organization", "name": "RonCare Daily"},
    "publisher": {"@type": "Organization", "name": "RonCare Daily"},
    "description": "A daily briefing on AI in healthcare administration, the population ageing crisis, and practical support resources for family carers across Europe."
  }
  </script>
</head>
<body>
  <header>
    <div class="container">
      <a href="../index.html" class="site-name">RonCare Daily</a>
      <p class="tagline">Informed. Resourceful. For carers and those who care.</p>
    </div>
  </header>

  <main class="container">
    <article>
      <div class="post-meta">
        <time datetime="${dateStr}">${formattedDate}</time>
        <h1>Daily Briefing</h1>
      </div>

${sectionsHTML}
    </article>
  </main>

  <footer>
    <div class="container">
      <p>RonCare Daily publishes automated daily briefings using AI-assisted research. Always verify information from original sources before acting on it.</p>
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
    .map(({ topic, content }) => topicSectionHTML(topic, content))
    .join('\n\n');

  const archiveHTML = allPosts.length > 1
    ? `\n  <aside class="archive">
    <div class="container">
      <h2>Previous Briefings</h2>
      <ul>
        ${allPosts.slice(1).map(p =>
          `<li><a href="posts/${p.dateStr}.html">${formatShortDate(p.date)}</a></li>`
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
  <meta name="description" content="A free daily briefing for family carers. Covering AI in healthcare, the ageing population crisis, and practical support resources for carers across Europe. Updated every morning.">
  <meta name="keywords" content="family carers, carer support Ireland, AI in healthcare, ageing population crisis, caring for elderly parents, carer burnout support, social care news, carer resources Europe, unpaid carers">
  <meta property="og:title" content="RonCare Daily — News &amp; Resources for Family Carers">
  <meta property="og:description" content="Daily briefings on AI in healthcare, the ageing crisis, and carer support resources.">
  <meta property="og:type" content="website">
  <link rel="stylesheet" href="styles.css">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": "RonCare Daily",
    "description": "A free daily briefing for family carers covering AI in healthcare, the population ageing crisis, and practical carer resources across Europe.",
    "publisher": {"@type": "Organization", "name": "RonCare Daily"}
  }
  </script>
</head>
<body>
  <header>
    <div class="container">
      <span class="site-name">RonCare Daily</span>
      <p class="tagline">Informed. Resourceful. For carers and those who care.</p>
    </div>
  </header>

  <main class="container">
    <div class="post-meta">
      <time datetime="${today.dateStr}">${formattedDate}</time>
      <h1>Today's Briefing</h1>
    </div>

${sectionsHTML}
  </main>
${archiveHTML}

  <footer>
    <div class="container">
      <p>RonCare Daily publishes automated daily briefings using AI-assisted research. Always verify information from original sources.</p>
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

  console.log(`\nRonCare Daily — generating briefing for ${dateStr}\n`);

  const postsDir = path.join(__dirname, 'posts');
  if (!fs.existsSync(postsDir)) fs.mkdirSync(postsDir, { recursive: true });

  const postPath = path.join(postsDir, `${dateStr}.html`);
  if (fs.existsSync(postPath) && !process.argv.includes('--force')) {
    console.log(`Today's post already exists. Run with --force to regenerate.`);
    return;
  }

  // Generate all three topic sections
  const sections = [];
  for (const topic of TOPICS) {
    const content = await generateTopicContent(topic);
    sections.push({ topic, content });
  }

  // Write dated post
  fs.writeFileSync(postPath, generatePostHTML(today, sections), 'utf8');
  console.log(`\n✓  Post written: posts/${dateStr}.html`);

  // Gather all posts for archive + update index
  const allPosts = fs.readdirSync(postsDir)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.html$/.test(f))
    .sort()
    .reverse()
    .map(f => ({
      filename: f,
      dateStr:  f.replace('.html', ''),
      date:     new Date(f.replace('.html', '') + 'T07:00:00'),
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
