const { Client, GatewayIntentBits } = require('discord.js');
const http = require('http');

const TOKEN = (process.env.DISCORD_BOT_TOKEN || '').trim();
const port = process.env.PORT || 4000;

console.log('=== 起動開始 ===');
console.log('DISCORD_BOT_TOKEN が設定されているか:', TOKEN.length > 0);

// ---- HTTP サーバ（Render Web Service 用） ----
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running');
});

server.listen(port, '0.0.0.0', () => {
  console.log(`HTTP server listening on port ${port}`);
});

// ---- Discord クライアント作成 ----
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

// ---- ログ・エラーを全部吐く ----
client.on('debug', (m) => console.log('[DEBUG]', m));
client.on('warn', (m) => console.warn('[WARN]', m));
client.on('error', (m) => console.error('[CLIENT ERROR]', m));
client.on('shardError', (err) => console.error('[SHARD ERROR]', err));

process.on('unhandledRejection', (reason, p) => {
  console.error('[UNHANDLED REJECTION]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});

// ---- イベント動作確認用 ----
client.once('ready', () => {
  console.log(`✅ ready 発火: ログイン中ユーザー → ${client.user.tag}`);
});

client.on('messageCreate', (msg) => {
  console.log('📩 messageCreate:', {
    author: `${msg.author.tag}`,
    content: msg.content,
  });

  if (msg.author.bot) return;

  if (msg.content === 'ping') {
    msg.channel.send('pong from Render!');
  }
});

// ---- 実際のログイン ----
if (!TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN が設定されていません');
} else {
  console.log('Discord ログインを試みます…');

  (async () => {
    try {
      const result = await client.login(TOKEN);
      console.log('✅ client.login() resolve:', result);
    } catch (err) {
      console.error('❌ Discord ログインに失敗しました:', err);
    }
  })();
}
