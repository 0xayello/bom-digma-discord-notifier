// rss-to-discord.js
require('dotenv').config();
const Parser = require('rss-parser');
const axios  = require('axios');
const fs     = require('fs');
const path   = require('path');

// CONFIG
const FEED_URL    = 'https://www.bomdigma.com.br/feed';
const CACHE_FILE  = path.resolve(__dirname, 'last_discord_item.txt');
const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// Compatibilidade: usa DISCORD_LEITOR_ROLE_ID (novo) ou DISCORD_ROLE_ID (legado)
const LEITOR_ROLE_ID = process.env.DISCORD_LEITOR_ROLE_ID || process.env.DISCORD_ROLE_ID;

// DEBUG opcional: defina DEBUG=true no ambiente
const DEBUG = String(process.env.DEBUG || '').toLowerCase() === 'true';

if (DEBUG) {
  console.log('DEBUG :: VARS PRESENT ->', {
    DISCORD_WEBHOOK_URL: !!WEBHOOK_URL,
    DISCORD_LEITOR_ROLE_ID: !!process.env.DISCORD_LEITOR_ROLE_ID,
    DISCORD_ROLE_ID: !!process.env.DISCORD_ROLE_ID,
  });
}

// Lê o último link notificado
function getLastNotifiedLink() {
  if (!fs.existsSync(CACHE_FILE)) return null;
  return fs.readFileSync(CACHE_FILE, 'utf-8').trim();
}

// Grava novo link no cache
function setLastNotifiedLink(link) {
  fs.writeFileSync(CACHE_FILE, link, 'utf-8');
}

// Busca o item mais recente do RSS
async function fetchLatestPost() {
  const parser = new Parser();
  const feed   = await parser.parseURL(FEED_URL);
  return feed.items?.[0];
}

// Publica no Discord
async function notifyDiscord({ title, summary, link }) {
  if (!WEBHOOK_URL)    throw new Error('Missing DISCORD_WEBHOOK_URL');
  if (!LEITOR_ROLE_ID) throw new Error('Missing DISCORD_LEITOR_ROLE_ID (or DISCORD_ROLE_ID fallback)');

  const content =
    `**${title}** <@&${LEITOR_ROLE_ID}>` +
    `\n\n${summary || ''}` +
    `\n\n👇 Confira a edição completa aqui: ${link}`;

  await axios.post(WEBHOOK_URL, {
    content,
    allowed_mentions: {
      parse: [],
      roles: [LEITOR_ROLE_ID],
      users: []
    }
  });
}

// Execução principal
async function run() {
  try {
    const latest = await fetchLatestPost();
    if (!latest) {
      console.log('🛑 Nenhum item retornado no feed. Abortando.');
      return;
    }

    // Só publica se a data for hoje (BRT)
    const postDateBR = new Date(latest.isoDate)
      .toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const todayBR = new Date()
      .toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    if (postDateBR !== todayBR) {
      console.log(`🛑 Edição de ${postDateBR} não é de hoje (${todayBR}). Abortando.`);
      return;
    }

    // Evita republicar o mesmo link
    const lastLink = getLastNotifiedLink();
    if (latest.link === lastLink) {
      console.log('🛑 Mesma edição já publicada hoje. Abortando.');
      return;
    }

    // Publica no Discord
    await notifyDiscord({
      title:   latest.title,
      summary: latest.contentSnippet || '',
      link:    latest.link
    });

    // Atualiza cache
    setLastNotifiedLink(latest.link);
    console.log('✅ Notificação enviada e cache atualizado!');
  } catch (err) {
    console.error('❌ Erro completo:', err.stack || err.message);
    process.exit(1);
  }
}

if (require.main === module) run();
