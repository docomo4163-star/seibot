// index.js
const { Client, GatewayIntentBits, Events } = require('discord.js');
const express = require('express'); // Expressを読み込み

const app = express();
const PORT = process.env.PORT || 4000;
const TOKEN = (process.env.DISCORD_BOT_TOKEN || '').trim();

// ==== 1. Webサーバーを最優先で起動 ====

// RenderのHealth Check用 (設定が /healthz なのでここに合わせます)
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// メインアクセス用
app.get('/', (req, res) => {
  res.status(200).send('Bot is running!');
});

app.listen(PORT, () => {
  console.log(`✅ Web Server running on port ${PORT}`);
});

// ==== 2. Botの準備 ====
if (!TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN がありません');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Discordログイン完了: ${c.user.tag}`);
  c.user.setActivity('性的な人生0.4', { type: 0 });
});

client.on(Events.MessageCreate, (message) => {
  if (message.author.bot) return;

  if (message.content === 'ping') {
    message.reply('pong').catch(console.error);
  }
  if (message.content === 'せいは') {
    message.reply('ちんぱん').catch(console.error);
  }
});

client.on('error', (err) => console.error('[CLIENT ERROR]', err));

// ==== 3. ログイン実行 ====
client.login(TOKEN).catch((err) => {
  console.error('❌ Discordログイン失敗:', err);
  process.exit(1);
});
