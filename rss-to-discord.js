require('dotenv').config();
const Parser = require('rss-parser');
const axios  = require('axios');
const fs     = require('fs');
const path   = require('path');

// — CONFIGURAÇÃO — 
const FEED_URL   = 'https://www.bomdigma.com.br/feed';
const CACHE_FILE = path.resolve(__dirname, 'last_discord_item.txt');
const ROLE_ID    = process.env.DISCORD_ROLE_ID;      // ID da role @Leitor
const WEBHOOK    = process.env.DISCORD_WEBHOOK_URL;  // URL do Webhook

// — FUNÇÕES DE CACHE — 
function getLastNotifiedLink() {
  if (!fs.existsSync(CACHE_FILE)) return null;
  const link = fs.readFileSync(CACHE_FILE, 'utf-8').trim();
  return link || null;
}
function setLastNotifiedLink(link) {
  fs.writeFileSync(CACHE_FILE, link, 'utf-8');
}

// — BUSCA O RSS — 
async function fetchLatestPost() {
  const parser = new Parser();
  const feed   = await parser.parseURL(FEED_URL);
  return feed.items[0];
}

// — ENVIA PRO DISCORD — 
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

// — FLUXO PRINCIPAL — 
async function run() {
  try {
    const latest   = await fetchLatestPost();
    const lastLink = getLastNotifiedLink();

    // Se já postamos este link, aborta sem nada novo:
    if (latest.link === lastLink) {
      console.log('🛑 Sem novidades. Abortando.');
      return;
    }

    // Caso seja realmente um link novo, dispara e atualiza cache
    await notifyDiscord({
      title:   latest.title,
      summary: latest.contentSnippet || '',
      link:    latest.link
    });
    setLastNotifiedLink(latest.link);
    console.log('✅ Notificação enviada com sucesso!');
  } catch (err) {
    console.error('❌ Erro completo:', err.stack);
    process.exit(1);
  }
}

if (require.main === module) run();
