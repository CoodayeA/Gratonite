export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type AppTabParamList = {
  Guilds: undefined;
  DMs: undefined;
  Friends: undefined;
};

export type AppStackParamList = {
  MainTabs: undefined;
  GuildChannels: { guildId: string; guildName: string };
  ChannelChat: { channelId: string; channelName: string; guildId: string };
  VoiceChannel: { channelId: string; channelName: string; guildId: string };
  DirectMessage: { channelId: string; recipientName: string };
  CreateGuild: undefined;
  GuildSettings: { guildId: string; guildName: string };
  GuildMemberList: { guildId: string; guildName: string };
  InviteAccept: { code: string };
};
