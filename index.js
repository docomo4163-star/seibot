// index.js
// Render の Web Service 用 & env から TOKEN を読む最小構成

const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');

// ==== 環境変数 ====
const TOKEN = (process.env.DISCORD_BOT_TOKEN || '').trim();
const PORT = process.env.PORT || 4000;

console.log('=== Bot 起動 ===');
console.log('DISCORD_BOT_TOKEN が設定されているか:', TOKEN.length > 0);

if (!TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN が設定されていません');
  process.exit(1);
}

// ==== Render 用 HTTP サーバ（Web Service 必須）====
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Bot is running');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`HTTP server listening on port ${PORT}`);
});

// ==== Discord クライアント ====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ==== ログ・エラーハンドラ（デバッグ用）====
client.once('ready', (c) => {
  console.log(`✅ ${c.user.tag} でログイン中`);
  c.user.setActivity("性的な人生", { type: 0 }); // プレイ中: 性的な人生
});

process.on('unhandledRejection', (reason) => {
  console.error('=== UNHANDLED REJECTION ===');
  console.error(reason);
});

process.on('uncaughtException', (err) => {
  console.error('=== UNCAUGHT EXCEPTION ===');
  console.error(err);
});

// ==== メッセージ応答 ====
// ・ping → pong
// ・せいは → ちんぱん（元コードの動作も一応入れておく）
client.on('messageCreate', (message) => {
  if (message.author.bot) return;

  const content = message.content;

  if (content === 'ping') {
    return message.reply('pong');
  }

  if (content === 'せいは') {
    return message.reply('ちんぱん');
  }
});

// ==== Discord にログイン ====
console.log('Discord ログインを試みます…');

client
  .login(TOKEN)
  .then(() => {
    console.log('✅ Discord ログイン成功');
  })
  .catch((err) => {
    console.error('❌ Discord ログインに失敗しました:', err);
  });
