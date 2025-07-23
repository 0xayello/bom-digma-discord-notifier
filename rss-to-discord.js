require('dotenv').config();
const Parser = require('rss-parser');
const axios  = require('axios');
const fs     = require('fs');
const path   = require('path');

const FEED_URL   = 'https://www.bomdigma.com.br/feed';
const CACHE_FILE = path.resolve(__dirname, 'last_discord_item.txt');
const ROLE_ID    = process.env.DISCORD_ROLE_ID;
const WEBHOOK    = process.env.DISCORD_WEBHOOK_URL;

function getLastNotifiedLink() {
  if (!fs.existsSync(CACHE_FILE)) return null;
  const link = fs.readFileSync(CACHE_FILE, 'utf-8').trim();
  return link || null;
}
function setLastNotifiedLink(link) {
  fs.writeFileSync(CACHE_FILE, link, 'utf-8');
}

async function fetchLatestPost() {
  const parser = new Parser();
  const feed   = await parser.parseURL(FEED_URL);
  return feed.items[0];
}

async function notifyDiscord({ title, summary, link }) {
  if (!WEBHOOK) throw new Error('Missing DISCORD_WEBHOOK_URL');
  let content = "**" + title + "**";
  if (ROLE_ID) content += " <@&" + ROLE_ID + ">";
  content += "\n\n" + summary;
  content += "\n\n👇 Confira a edição completa aqui: " + link;

  await axios.post(WEBHOOK, {
    content,
    allowed_mentions: { roles: ROLE_ID ? [ROLE_ID] : [] }
  });
}

async function run() {
  const latest   = await fetchLatestPost();
  const lastLink = getLastNotifiedLink();

  console.log("latest.link =", latest.link);
  console.log("lastLink    =", lastLink);

  if (latest.link === lastLink) {
    console.log('🛑 Sem novidades. Abortando.');
    return;
  }

  await notifyDiscord({
    title:   latest.title,
    summary: latest.contentSnippet || '',
    link:    latest.link
  });
  setLastNotifiedLink(latest.link);
  console.log('✅ Notificação enviada com sucesso!');
}

if (require.main === module) run();
