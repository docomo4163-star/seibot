// index.js
// 🔥 テスト用にトークン直書きバージョン（公開厳禁・あとで必ず消す）

const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');

// ここに「そのまま」のボットトークン文字列をコピペ
// 例: const TOKEN = 'ABCD.....XYZ';
const TOKEN = 'ここにDiscordボットトークンを貼る';

// Render の PORT（ローカルならデフォルト4000でもOK）
const PORT = process.env.PORT || 4000;

console.log('=== Bot 起動 ===');
console.log('ハードコードTOKENの長さ:', TOKEN.length);

// ---- Render用 HTTPサーバ（Web Service のため）----
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Bot is running (hard-coded token test)');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`HTTP server listening on port ${PORT}`);
});

// ---- Discordクライアント作成 ----
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ready
client.once('ready', () => {
  console.log(`✅ ready 発火: ${client.user.tag} としてログイン中`);
});

// メッセージ (ping → pong)
client.on('messageCreate', (message) => {
  console.log('📩 messageCreate:', {
    author: `${message.author.tag}`,
    content: message.content,
  });

  if (message.author.bot) return;

  if (message.content === 'ping') {
    message.reply('pong (from Render, hard-coded token)');
  }
});

// エラーハンドラ（念のため）
client.on('error', (err) => console.error('[CLIENT ERROR]', err));
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

// ---- ログイン ----
console.log('Discord ログインを試みます…');

client
  .login(TOKEN)
  .then(() => {
    console.log('✅ Discord ログイン成功');
  })
  .catch((err) => {
    console.error('❌ Discord ログインに失敗しました:', err);
  });
