// Carrega variáveis de ambiente
require('dotenv').config();
const Parser = require('rss-parser');
const axios  = require('axios');
const fs     = require('fs');
const path   = require('path');

// URL do feed e arquivo de cache local
const FEED_URL   = 'https://www.bomdigma.com.br/feed';
const CACHE_FILE = path.resolve(__dirname, 'last_discord_item.txt');

// Lê o último link que já foi notificado
async function getLastNotifiedLink() {
  if (!fs.existsSync(CACHE_FILE)) return null;
  return fs.readFileSync(CACHE_FILE, 'utf-8').trim();
}

// Salva o link da última notificação
async function setLastNotifiedLink(link) {
  fs.writeFileSync(CACHE_FILE, link, 'utf-8');
}

// Busca a última edição do RSS
async function fetchLatestPost() {
  const parser = new Parser();
  const feed   = await parser.parseURL(FEED_URL);
  return feed.items[0];
}

// Envia o embed para o Discord via Webhook
async function notifyDiscord({ title, summary, link }) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) throw new Error('Defina DISCORD_WEBHOOK_URL nos Secrets do GitHub');

  const payload = {
    embeds: [{
      title: `📝 Nova edição: ${title}`,
      description: `${summary.substring(0, 200)}...`,
      url: link,
      timestamp: new Date().toISOString(),
    }]
  };

  await axios.post(webhookUrl, payload);
}

// Função principal
async function run() {
  try {
    const latest   = await fetchLatestPost();
    const lastLink = await getLastNotifiedLink();

    // —— AQUI está a checagem para evitar duplicatas ——  
    if (latest.link === lastLink) {
      console.log('🛑 Sem novidades desde a última vez. Abortando envio.');
      return;
    }

    // Se for link novo, publica e atualiza cache
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

// Se o script for executado diretamente…
if (require.main === module) run();
