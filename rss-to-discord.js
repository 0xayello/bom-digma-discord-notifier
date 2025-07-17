require('dotenv').config();
const Parser = require('rss-parser');
const axios  = require('axios');
const fs     = require('fs');
const path   = require('path');

// 1) URL do seu RSS e arquivo de cache:
const FEED_URL   = 'https://www.bomdigma.com.br/feed';
const CACHE_FILE = path.resolve(__dirname, 'last_discord_item.txt');

// 2) Opcional: ID da role que será mencionada (@leitor). Cadastre em Settings→Secrets:
const ROLE_ID    = process.env.DISCORD_ROLE_ID;  // ex: '123456789012345678'

// 3) Funções de cache local para evitar duplicatas
async function getLastNotifiedLink() {
  if (!fs.existsSync(CACHE_FILE)) return null;
  return fs.readFileSync(CACHE_FILE, 'utf-8').trim();
}
async function setLastNotifiedLink(link) {
  fs.writeFileSync(CACHE_FILE, link, 'utf-8');
}

// 4) Busca a última edição no RSS
async function fetchLatestPost() {
  const parser = new Parser();
  const feed   = await parser.parseURL(FEED_URL);
  return feed.items[0];
}

// 5) Envia o EMBED para o Discord via webhook
async function notifyDiscord({ title, summary, link }) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) throw new Error('Defina DISCORD_WEBHOOK_URL nos Secrets do GitHub');

  // prefixa a menção à role, se estiver configurada
  const content = ROLE_ID
    ? `<@&${ROLE_ID}>`
    : null;

  // o EMBED:
  const embed = {
    title:       `📝 Nova edição: ${title}`,
    description: summary.substring(0, 200) + '…',
    url:         link,
    timestamp:   new Date().toISOString(),
    footer:      { text: 'bomdigma.com.br' }
    // você pode adicionar thumbnail/image aqui, se quiser
  };

  await axios.post(webhookUrl, {
    content,
    embeds: [embed],
    allowed_mentions: { roles: ROLE_ID ? [ROLE_ID] : [] }
  });
}

// 6) Fluxo principal
async function run() {
  try {
    const latest   = await fetchLatestPost();
    const lastLink = await getLastNotifiedLink();

    // —— evita republicar a mesma edição ——  
    if (latest.link === lastLink) {
      console.log('🛑 Sem novidades. Abortando.');
      return;
    }

    // publica e atualiza cache
    await notifyDiscord({
      title:   latest.title,
      summary: latest.contentSnippet || '',
      link:    latest.link
    });
    await setLastNotifiedLink(latest.link);

    console.log('✅ Notificação enviada ao Discord!');
  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
}

// Executa se invocado diretamente:
if (require.main === module) run();
