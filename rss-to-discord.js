require('dotenv').config();
const Parser = require('rss-parser');
const axios  = require('axios');
const fs     = require('fs');
const path   = require('path');

// CONFIGURAÇÃO
const FEED_URL    = 'https://www.bomdigma.com.br/feed';
const CACHE_FILE  = path.resolve(__dirname, 'last_discord_item.txt');
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const ROLE_ID     = process.env.DISCORD_ROLE_ID; // <- ID numérico da role @Leitor

// Função: lê último link notificado
function getLastNotifiedLink() {
  if (!fs.existsSync(CACHE_FILE)) return null;
  return fs.readFileSync(CACHE_FILE, 'utf-8').trim();
}

// Função: grava novo link no cache
function setLastNotifiedLink(link) {
  fs.writeFileSync(CACHE_FILE, link, 'utf-8');
}

// Função: busca item mais recente do RSS
async function fetchLatestPost() {
  const parser = new Parser();
  const feed   = await parser.parseURL(FEED_URL);
  return feed.items[0];
}

// Função: publica no Discord
async function notifyDiscord({ title, summary, link }) {
  if (!WEBHOOK_URL) throw new Error('Missing DISCORD_WEBHOOK_URL');

  // título em negrito + menção da role (se houver), subtítulo e link
  let content = '**' + title + '**';
  if (ROLE_ID) content += ' <@&' + ROLE_ID + '>';
  content += '\n\n' + (summary || '');
  content += '\n\n👇 Confira a edição completa aqui: ' + link;

  await axios.post(WEBHOOK_URL, {
    content,
    // só permite pingar essa role; se ROLE_ID não existir, não menciona ninguém
    allowed_mentions: ROLE_ID ? { roles: [ROLE_ID] } : { users: [], roles: [] }
  });
}

async function run() {
  try {
    const latest = await fetchLatestPost();

    // — 1) Date guard: só publica se a data do post for igual à data de hoje em BRT
    const postDateBR  = new Date(latest.isoDate)
      .toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const todayBR     = new Date()
      .toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    if (postDateBR !== todayBR) {
      console.log(`🛑 Edição de ${postDateBR} não é de hoje (${todayBR}). Abortando.`);
      return;
    }

    // — 2) Cache guard: evita republicar o mesmo link (mesmo dia/manual rerun)
    const lastLink = getLastNotifiedLink();
    if (latest.link === lastLink) {
      console.log('🛑 Mesma edição já publicada hoje. Abortando.');
      return;
    }

    // — 3) Publica no Discord
    await notifyDiscord({
      title:   latest.title,
      summary: latest.contentSnippet || '',
      link:    latest.link
    });

    // — 4) Atualiza o cache
    setLastNotifiedLink(latest.link);
    console.log('✅ Notificação enviada e cache atualizado!');

  } catch (err) {
    console.error('❌ Erro completo:', err.stack);
    process.exit(1);
  }
}

if (require.main === module) run();
