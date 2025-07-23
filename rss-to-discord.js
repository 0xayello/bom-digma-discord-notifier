require('dotenv').config();
const Parser = require('rss-parser');
const axios  = require('axios');
const fs     = require('fs');
const path   = require('path');

// ————— CONFIGURAÇÃO —————
const FEED_URL        = 'https://www.bomdigma.com.br/feed';
const CACHE_FILE      = path.resolve(__dirname, 'last_discord_item.txt');
const DATE_CACHE_FILE = path.resolve(__dirname, 'last_discord_date.txt');
const ROLE_ID         = process.env.DISCORD_ROLE_ID;
const WEBHOOK         = process.env.DISCORD_WEBHOOK_URL;

// ————— HELPERS DE CACHE —————
function getLastNotifiedLink() {
  if (!fs.existsSync(CACHE_FILE)) return null;
  const link = fs.readFileSync(CACHE_FILE, 'utf-8').trim();
  return link || null;
}
function setLastNotifiedLink(link) {
  fs.writeFileSync(CACHE_FILE, link, 'utf-8');
}

function getLastNotifiedDate() {
  if (!fs.existsSync(DATE_CACHE_FILE)) return null;
  const raw = fs.readFileSync(DATE_CACHE_FILE, 'utf-8').trim();
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}
function setLastNotifiedDate(dateIso) {
  fs.writeFileSync(DATE_CACHE_FILE, dateIso, 'utf-8');
}

// ————— BUSCA RSS —————
async function fetchLatestPost() {
  const parser = new Parser();
  const feed   = await parser.parseURL(FEED_URL);
  return feed.items[0];
}

// ————— DISPATCH PARA O DISCORD —————
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

// ————— FLUXO PRINCIPAL —————
async function run() {
  try {
    const latest    = await fetchLatestPost();
    const lastLink  = getLastNotifiedLink();
    const pubDate   = new Date(latest.isoDate || latest.pubDate);
    const lastDate  = getLastNotifiedDate();

    // — DEBUG (comente depois de validar) —
    console.log('▶️ Notifier start');
    console.log(' latest.link =', latest.link);
    console.log(' lastLink    =', lastLink);
    console.log(' pubDate     =', pubDate.toISOString());
    console.log(' lastDate    =', lastDate ? lastDate.toISOString() : null);

    // Abortar se link ou data já postados
    if (latest.link === lastLink || (lastDate && pubDate <= lastDate)) {
      console.log('🛑 Sem novidades. Abortando.');
      return;
    }

    // Caso seja nova edição…
    await notifyDiscord({
      title:   latest.title,
      summary: latest.contentSnippet || '',
      link:    latest.link
    });

    // Atualiza caches
    setLastNotifiedLink(latest.link);
    setLastNotifiedDate(pubDate.toISOString());
    console.log('✅ Notificação enviada com sucesso!');
  } catch (err) {
    console.error('❌ Erro completo:', err.stack);
    process.exit(1);
  }
}

if (require.main === module) run();
