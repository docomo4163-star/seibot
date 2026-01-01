// index.js
const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');

const TOKEN = (process.env.DISCORD_BOT_TOKEN || '').trim();
const PORT = process.env.PORT || 4000;

console.log('=== Bot 起動 ===');
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
client.on('error', (err) => console.error('=== CLIENT ERROR ===', err));
client.on('shardError', (err) => console.error('=== SHARD ERROR ===', err));

// ---- ready ----
client.once('ready', (c) => {
  isReady = true;
  console.log(`✅ ${c.user.tag} でログイン完了`);
  c.user.setActivity('性的な人生0.6', { type: 0 });
});

// ---- メッセージ ----
client.on('messageCreate', (message) => {
  console.log('aaa')
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
  // RenderのHealth Check用パス
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('OK');
  }

  // メインルートへのアクセス
  if (isReady) {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bot is running & logged in ✅');
  } else {
    // 準備中の場合は 503 を返すのがWeb標準として適切です
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bot is initializing... ⏳');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`HTTP server listening on port ${PORT}`);
});

// ==== シャットダウン処理 (重要) ====
// Renderなどのクラウド環境では、再デプロイ時に SIGTERM シグナルが送られます。
// ここで明示的に切断しないと、古い接続が残り続け、新しい接続が拒否されます。
const gracefulShutdown = () => {
  console.log('⚠️ SIGTERM を受信しました。シャットダウン処理を開始します...');
  client.destroy(); // Discordからログアウト
  server.close(() => { // HTTPサーバを停止
    console.log('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// ==== Discord にログイン ====
console.log('Discord ログインを試みます…');

const loginTimeout = setTimeout(() => {
  if (!isReady) {
    console.error(`⚠️ ${LOGIN_TIMEOUT_MS}ms 経っても ready にならないため終了します`);
    process.exit(1);
  }
}, LOGIN_TIMEOUT_MS);

client
  .login(TOKEN)
  .then(() => {
    console.log('Discord APIへの接続リクエスト成功');
  })
  .catch((err) => {
    clearTimeout(loginTimeout);
    console.error('❌ Discord ログイン失敗:', err);
    process.exit(1);
  });
