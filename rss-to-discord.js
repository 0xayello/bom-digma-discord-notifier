require('dotenv').config();
const Parser    = require('rss-parser');
const axios     = require('axios');
const fs        = require('fs');
const path      = require('path');
const { execSync } = require('child_process');

// CONFIGURAÇÃO
const FEED_URL    = 'https://www.bomdigma.com.br/feed';
const CACHE_FILE  = path.resolve(__dirname, 'last_discord_item.txt');
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Lê o último link notificado
async function getLastNotifiedLink() {
  if (!fs.existsSync(CACHE_FILE)) return null;
  return fs.readFileSync(CACHE_FILE, 'utf-8').trim();
}

// Atualiza o cache local e comita de volta na main
async function setLastNotifiedLink(link) {
  fs.writeFileSync(CACHE_FILE, link, 'utf-8');

  try {
    execSync('git add last_discord_item.txt', { stdio: 'ignore' });
    execSync('git commit -m "chore: update last_discord_item cache [skip ci]"', { stdio: 'ignore' });
    // força push para main
    execSync('git push origin HEAD:main', { stdio: 'ignore' });
  } catch (e) {
    console.warn('⚠️ Git push falhou, o cache não foi persistido:', e.message);
  }
}

// Busca a última edição do RSS
async function fetchLatestPost() {
  const parser = new Parser();
  const feed   = await parser.parseURL(FEED_URL);
  return feed.items[0];
}

// Publica no Discord
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

    // Se for igual, aborta tranquilamente
    if (latest.link === lastLink) {
      console.log('🛑 Sem novidades desde a última vez. Abortando.');
      return;
    }

    // Caso novo, dispara e atualiza cache
    await notifyDiscord({
      title:   latest.title,
      summary: latest.contentSnippet || '',
      link:    latest.link
    });
    await setLastNotifiedLink(latest.link);
    console.log('✅ Notificação enviada e cache atualizado!');

  } catch (err) {
    console.error('❌ Erro completo:', err.stack);
    process.exit(1);
  }
}

if (require.main === module) run();
