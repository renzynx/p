export type Guild = {
  id: string;
  name: string;
  icon: string | null;
  banner: string | null;
  owner: boolean;
  permissions: number;
  permissions_new: string;
  features: string[];
};

type PermissionOverwrite = {
  id: string;
  type: number;
  allow: string;
  deny: string;
};

type ChannelType = 0 | 2 | 4; // 0 = Text, 2 = Voice, 4 = Category

type IconEmoji = {
  id: string | null;
  name: string;
};

export type Channel = {
  id: string;
  type: ChannelType;
  guild_id: string;
  name: string;
  position: number;
  parent_id: string | null;
  flags: number;
  permission_overwrites: PermissionOverwrite[];

  // Optional (depends on type)
  topic?: string | null;
  nsfw?: boolean;
  rate_limit_per_user?: number;
  last_message_id?: string | null;

  // Voice-specific
  bitrate?: number;
  user_limit?: number;
  rtc_region?: string | null;
  icon_emoji?: IconEmoji | null;
  theme_color?: number | null;
  voice_background_display?: unknown;
};

export type Webhook = {
  id: string;
  type: number;
  guild_id?: string;
  channel_id: string;
  name: string;
  avatar: string | null;
  token?: string;
  application_id: string | null;
  url?: string;
};
