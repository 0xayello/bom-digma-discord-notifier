require('dotenv').config();
const Parser = require('rss-parser');
const axios  = require('axios');
const fs     = require('fs');
const path   = require('path');

// CONFIG
const FEED_URL   = 'https://www.bomdigma.com.br/feed';
const CACHE_FILE = path.resolve(__dirname, 'last_discord_item.txt');
const ROLE_ID    = process.env.DISCORD_ROLE_ID;  
const WEBHOOK    = process.env.DISCORD_WEBHOOK_URL;

// DEBUG: confirma que as vars chegam via Actions
console.log('▶️ Starting notifier');
console.log('   WEBHOOK:', !!WEBHOOK);
console.log('   ROLE_ID:', ROLE_ID);

async function getLastNotifiedLink() {
  return fs.existsSync(CACHE_FILE)
    ? fs.readFileSync(CACHE_FILE, 'utf-8').trim()
    : null;
}

async function setLastNotifiedLink(link) {
  fs.writeFileSync(CACHE_FILE, link, 'utf-8');
}

async function fetchLatestPost() {
  const parser = new Parser();
  const { items } = await parser.parseURL(FEED_URL);
  return items[0];
}

async function notifyDiscord({ title, summary, link }) {
  if (!WEBHOOK) throw new Error('Missing DISCORD_WEBHOOK_URL');
  const content = ROLE_ID ? `<@&${ROLE_ID}>` : null;
  const embed = {
    title:       `📝 Nova edição: ${title}`,
    description: summary.substring(0, 200) + '…',
    url:         link,
    timestamp:   new Date().toISOString(),
    footer:      { text: 'bomdigma.com.br' }
  };
  await axios.post(WEBHOOK, {
    content, embeds: [embed],
    allowed_mentions: { roles: ROLE_ID ? [ROLE_ID] : [] }
  });
}

async function run() {
  try {
    const latest   = await fetchLatestPost();
    const lastLink = await getLastNotifiedLink();
    if (latest.link === lastLink) {
      console.log('🛑 Sem novidades. Abortando.');
      return;
    }
    await notifyDiscord({
      title:   latest.title,
      summary: latest.contentSnippet || '',
      link:    latest.link
    });
    await setLastNotifiedLink(latest.link);
    console.log('✅ Notificação enviada!');
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  }
}

if (require.main === module) run();
