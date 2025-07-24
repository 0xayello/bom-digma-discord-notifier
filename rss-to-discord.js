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
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // provido automaticamente pelo Actions

// Lê, se existir, o último link notificado
async function getLastNotifiedLink() {
  if (!fs.existsSync(CACHE_FILE)) return null;
  return fs.readFileSync(CACHE_FILE, 'utf-8').trim();
}

// Atualiza o cache local
async function setLastNotifiedLink(link) {
  fs.writeFileSync(CACHE_FILE, link, 'utf-8');

  // Commita e faz push do arquivo de cache para o repo
  execSync('git config user.name "bom-digma-bot"', { stdio: 'ignore' });
  execSync('git config user.email "bot@users.noreply.github.com"', { stdio: 'ignore' });
  execSync('git add last_discord_item.txt', { stdio: 'ignore' });
  execSync('git commit -m "chore: update last_discord_item cache [skip ci]"', { stdio: 'ignore' });
  execSync('git push', { stdio: 'ignore' });
}

async function fetchLatestPost() {
  const parser = new Parser();
  const feed   = await parser.parseURL(FEED_URL);
  return feed.items[0];
}

async function notifyDiscord({ title, summary, link }) {
  if (!WEBHOOK_URL) throw new Error('Missing DISCORD_WEBHOOK_URL');
  // Monta o conteúdo
  let content = '**' + title + '**' +
                '\n\n' + summary +
                '\n\n👇 Confira a edição completa aqui: ' + link;

  await axios.post(WEBHOOK_URL, {
    content,
    allowed_mentions: { users: [], roles: [] }
  });
}

async function run() {
  try {
    // 1) Busca feed e último cache
    const latest   = await fetchLatestPost();
    const lastLink = await getLastNotifiedLink();

    // 2) Se for o mesmo link, aborta (e não faz push do cache)
    if (latest.link === lastLink) {
      console.log('🛑 Sem novidades desde a última vez. Abortando.');
      return;
    }

    // 3) Envia a notificação
    await notifyDiscord({
      title:   latest.title,
      summary: latest.contentSnippet || '',
      link:    latest.link
    });

    // 4) Atualiza o cache e comita de volta
    await setLastNotifiedLink(latest.link);
    console.log('✅ Notificação enviada e cache atualizado!');

  } catch (err) {
    console.error('❌ Erro completo:', err.stack);
    process.exit(1);
  }
}

if (require.main === module) run();
