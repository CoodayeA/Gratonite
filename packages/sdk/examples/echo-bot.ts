import { GratoniteBot } from '../src/client';

const bot = new GratoniteBot({
  token: process.env.BOT_TOKEN!,
  port: 3001,
});

bot.onMessage(async (event) => {
  if (event.message.content?.startsWith('!echo ')) {
    const text = event.message.content.slice(6);
    await bot.sendMessage(event.message.channelId, text);
  }
});

bot.start();
