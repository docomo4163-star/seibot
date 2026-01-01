// index.js
const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');

// ==== 環境変数 ====
const TOKEN = (process.env.DISCORD_BOT_TOKEN || '').trim();
const PORT = process.env.PORT || 4000;

// ==== 簡易チェック ====
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

// ログイン完了
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// メッセージ応答（ping → pong）
client.on('messageCreate', (message) => {
  if (message.author.bot) return; // Botは無視

  if (message.content === 'ping') {
    message.reply('pong');
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
