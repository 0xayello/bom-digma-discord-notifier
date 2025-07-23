require('dotenv').config();
const Parser = require('rss-parser');
const axios  = require('axios');
const fs     = require('fs');
const path   = require('path');

// CONFIGURAÇÃO
const FEED_URL        = 'https://www.bomdigma.com.br/feed';
const CACHE_FILE      = path.resolve(__dirname, 'last_discord_item.txt');
const DATE_CACHE_FILE = path.resolve(__dirname, 'last_discord_date.txt');
const ROLE_ID         = process.env.DISCORD_ROLE_ID;      // ID da role @Leitor
const WEBHOOK         = process.env.DISCORD_WEBHOOK_URL;  // URL do seu Webhook

// Helpers de cache
async function getLastNotifiedLink() {
  return fs.existsSync(CACHE_FILE)
    ? fs.readFileSync(CACHE_FILE, 'utf-8').trim()
    : null;
}
async function setLastNotifiedLink(link) {
  fs.writeFileSync(CACHE_FILE, link, 'utf-8');
}
async function getLastNotifiedDate() {
  return fs.existsSync(DATE_CACHE_FILE)
    ? new Date(fs.readFileSync(DATE_CACHE_FILE, 'utf-8').trim())
    : null;
}
async function setLastNotifiedDate(dateIso) {
  fs.writeFileSync(DATE_CACHE_FILE, dateIso, 'utf-8');
}

// Busca a última edição do RSS
async function fetchLatestPost() {
  const parser = new Parser();
  const feed   = await parser.parseURL(FEED_URL);
  return feed.items[0];
}

// Monta e envia a mensagem no Discord
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

// Função principal
async function run() {
  try {
    const latest    = await fetchLatestPost();
    const lastLink  = await getLastNotifiedLink();
    const pubDate   = new Date(latest.isoDate || latest.pubDate);
    const lastDate  = await getLastNotifiedDate();

    // Se já postamos este link OU esta data já foi processada, aborta
    if (latest.link === lastLink || (lastDate && pubDate <= lastDate)) {
      console.log('🛑 Sem novidades. Abortando.');
      return;
    }

    // Caso seja novo, posta e atualiza ambos caches
    await notifyDiscord({
      title:   latest.title,
      summary: latest.contentSnippet || '',
      link:    latest.link
    });
    await setLastNotifiedLink(latest.link);
    await setLastNotifiedDate(pubDate.toISOString());
    console.log('✅ Notificação enviada com sucesso!');
  } catch (err) {
    console.error('❌ Erro completo:', err.stack);
    process.exit(1);
  }
}

if (require.main === module) run();
