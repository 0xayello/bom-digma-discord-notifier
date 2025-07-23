require('dotenv').config();
const Parser = require('rss-parser');
const axios  = require('axios');
const fs     = require('fs');
const path   = require('path');

// CONFIGURAÇÃO
const FEED_URL        = 'https://www.bomdigma.com.br/feed';
const CACHE_FILE      = path.resolve(__dirname, 'last_discord_item.txt');
const DATE_CACHE_FILE = path.resolve(__dirname, 'last_discord_date.txt');
const ROLE_ID         = process.env.DISCORD_ROLE_ID;
const WEBHOOK         = process.env.DISCORD_WEBHOOK_URL;

// Helpers de cache
function getLastNotifiedLink() {
  return fs.existsSync(CACHE_FILE)
    ? fs.readFileSync(CACHE_FILE, 'utf-8').trim()
    : null;
}
function setLastNotifiedLink(link) {
  fs.writeFileSync(CACHE_FILE, link, 'utf-8');
}
function getLastNotifiedDate() {
  return fs.existsSync(DATE_CACHE_FILE)
    ? new Date(fs.readFileSync(DATE_CACHE_FILE, 'utf-8').trim())
    : null;
}
function setLastNotifiedDate(dateIso) {
  fs.writeFileSync(DATE_CACHE_FILE, dateIso, 'utf-8');
}

// Busca a última edição no RSS
async function fetchLatestPost() {
  const parser = new Parser();
  const feed   = await parser.parseURL(FEED_URL);
  return feed.items[0];
}

// Monta e envia mensagem no Discord
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

// Função principal com DEBUG
async function run() {
  try {
    const latest    = await fetchLatestPost();
    const lastLink  = getLastNotifiedLink();
    const pubDate   = new Date(latest.isoDate || latest.pubDate);
    const lastDate  = getLastNotifiedDate();

    // --- DEBUG OUTPUT ---
    console.log('▶️ Notifier start');
    console.log('latest.link  =', latest.link);
    console.log('lastLink     =', lastLink);
    console.log('pubDate      =', pubDate.toISOString());
    console.log('lastDate     =', lastDate ? lastDate.toISOString() : null);
    console.log('WEBHOOK ok   =', !!WEBHOOK, ' ROLE_ID =', ROLE_ID);

    // Abortamos se já postamos este link OU esta data já foi processada
    if (latest.link === lastLink || (lastDate && pubDate <= lastDate)) {
      console.log('🛑 Sem novidades. Abortando.');
      return;
    }

    // Publica e atualiza caches
    await notifyDiscord({
      title:   latest.title,
      summary: latest.contentSnippet || '',
      link:    latest.link
    });
    setLastNotifiedLink(latest.link);
    setLastNotifiedDate(pubDate.toISOString());
    console.log('✅ Notificação enviada com sucesso!');
  } catch (err) {
    console.error('❌ Erro completo:', err.stack);
    process.exit(1);
  }
}

if (require.main === module) run();
