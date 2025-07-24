require('dotenv').config();
const Parser = require('rss-parser');
const axios  = require('axios');
const fs     = require('fs');
const path   = require('path');

// CONFIGURAÇÃO
const FEED_URL    = 'https://www.bomdigma.com.br/feed';
const CACHE_FILE  = path.resolve(__dirname, 'last_discord_item.txt');
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// Lê o último link notificado
async function getLastNotifiedLink() {
  if (!fs.existsSync(CACHE_FILE)) return null;
  return fs.readFileSync(CACHE_FILE, 'utf-8').trim();
}

// Atualiza o cache local (sem qualquer Git aqui)
async function setLastNotifiedLink(link) {
  fs.writeFileSync(CACHE_FILE, link, 'utf-8');
}

async function fetchLatestPost() {
  const parser = new Parser();
  const feed   = await parser.parseURL(FEED_URL);
  return feed.items[0];
}

async function notifyDiscord({ title, summary, link }) {
  if (!WEBHOOK_URL) throw new Error('Missing DISCORD_WEBHOOK_URL');
  const content = '**' + title + '**'
                + '\n\n' + summary
                + '\n\n👇 Confira a edição completa aqui: ' + link;
  await axios.post(WEBHOOK_URL, {
    content,
    allowed_mentions: { users: [], roles: [] }
  });
}

async function run() {
  try {
    const latest   = await fetchLatestPost();
    const lastLink = await getLastNotifiedLink();

    // Se já foi publicado, aborta
    if (latest.link === lastLink) {
      console.log('🛑 Sem novidades desde a última vez. Abortando.');
      return;
    }

    // Dispara no Discord
    await notifyDiscord({
      title:   latest.title,
      summary: latest.contentSnippet || '',
      link:    latest.link
    });

    // Atualiza só o arquivo de cache
    await setLastNotifiedLink(latest.link);
    console.log('✅ Notificação enviada e cache atualizado!');

  } catch (err) {
    console.error('❌ Erro completo:', err.stack);
    process.exit(1);
  }
}

if (require.main === module) run();
