require('dotenv').config();
const Parser = require('rss-parser');
const axios  = require('axios');
const fs     = require('fs');
const path   = require('path');

// CONFIGURAÇÃO
const FEED_URL   = 'https://www.bomdigma.com.br/feed';
const CACHE_FILE = path.resolve(__dirname, 'last_discord_item.txt');
const ROLE_ID    = process.env.DISCORD_ROLE_ID;      // ID da role @Leitor
const WEBHOOK    = process.env.DISCORD_WEBHOOK_URL;  // URL do seu Webhook

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
  const feed   = await parser.parseURL(FEED_URL);
  return feed.items[0];
}

async function notifyDiscord({ title, summary, link }) {
  if (!WEBHOOK) throw new Error('Missing DISCORD_WEBHOOK_URL');

  // Monta mensagem de texto sem template literals para evitar syntax errors
  let content = "**🆕 " + title + "**";
  if (ROLE_ID) {
    content += " <@&" + ROLE_ID + ">";
  }
  content += "

" + summary;
  content += "

👇 Confira a edição completa aqui: " + link;

  await axios.post(WEBHOOK, {
    content,
    allowed_mentions: { roles: ROLE_ID ? [ROLE_ID] : [] }
  });
}(WEBHOOK, {
    content,
    allowed_mentions: { roles: ROLE_ID ? [ROLE_ID] : [] }
  });
}

async function run() {
  try {
    const latest   = await fetchLatestPost();
    const lastLink = await getLastNotifiedLink();

    // Evita republicar a mesma edição
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
    console.log('✅ Notificação enviada com sucesso!');
  } catch (err) {
    console.error('❌ Erro completo:', err.stack);
    process.exit(1);
  }
}

if (require.main === module) run();
