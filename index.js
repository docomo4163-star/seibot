// index.js
const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');

const TOKEN = (process.env.DISCORD_BOT_TOKEN || '').trim();
const PORT = process.env.PORT || 4000;

console.log('=== Bot 起動 ===');
console.log('DISCORD_BOT_TOKEN が設定されているか:', TOKEN.length > 0);
if (!TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN が設定されていません');
  process.exit(1);
}

// ログイン監視用フラグ & タイマー
let isReady = false;
const LOGIN_TIMEOUT_MS = 60000; // 60秒たってもreadyしなかったら落とす

// ==== Discord クライアント ====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ---- デバッグログ ----
client.on('debug', (m) => console.log('[DEBUG]', m));
client.on('warn', (m) => console.warn('[WARN]', m));
client.on('error', (err) => {
  console.error('=== CLIENT ERROR ===');
  console.error(err);
});
client.on('shardError', (err) => {
  console.error('=== SHARD ERROR ===');
  console.error(err);
});

process.on('unhandledRejection', (reason) => {
  console.error('=== UNHANDLED REJECTION ===');
  console.error(reason);
});
process.on('uncaughtException', (err) => {
  console.error('=== UNCAUGHT EXCEPTION ===');
  console.error(err);
});

// ---- ready ----
client.once('ready', (c) => {
  isReady = true;
  console.log(`✅ ${c.user.tag} でログイン中`);
  c.user.setActivity('性的な人生0.4', { type: 0 });
});

// ---- メッセージ ----
client.on('messageCreate', (message) => {
  if (message.author.bot) return;

  if (message.content === 'ping') {
    return message.reply('pong');
  }
  if (message.content === 'せいは') {
    return message.reply('ちんぱん');
  }
});

// ==== Render 用 HTTP サーバ ====
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });

  // RenderのHealth Check用
  if (req.url === '/health') {
    return res.end('OK');
  }

  if (isReady) {
    res.end('Bot is running & logged in ✅');
  } else {
    res.end('Bot process is running, but NOT logged in yet ❌');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`HTTP server listening on port ${PORT}`);
});

// ==== Discord にログイン ====
console.log('Discord ログインを試みます…');

// 一定時間 ready にならなかったら強制終了 → Render が再起動してくれる想定
const loginTimeout = setTimeout(() => {
  if (!isReady) {
    console.error(`⚠️ ${LOGIN_TIMEOUT_MS}ms 経っても ready にならないのでプロセスを終了します`);
    process.exit(1);
  }
}, LOGIN_TIMEOUT_MS);

client
  .login(TOKEN)
  .then(() => {
    console.log('✅ Discord ログイン成功 (login promise resolved)');
  })
  .catch((err) => {
    clearTimeout(loginTimeout);
    console.error('❌ Discord ログインに失敗しました:', err);
    process.exit(1);
  });
