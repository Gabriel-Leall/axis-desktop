// Slack domain types

export interface SlackUserProfile {
  image_48: string
  image_72: string
  real_name?: string
  display_name?: string
}

export interface SlackUser {
  id: string
  name: string
  real_name: string
  profile: SlackUserProfile
  team_id: string
}

export interface SlackMessageChannel {
  id: string
  name: string
}

export interface SlackMessage {
  ts: string
  text: string
  user: string // user ID — resolved separately
  channel: SlackMessageChannel
  permalink: string
  username?: string
}

export interface SlackLastMessage {
  text: string
  ts: string
}

export interface SlackDM {
  id: string // channel ID of DM conversation
  user: string // user ID of the other party
  unread_count: number
  last_message?: SlackLastMessage
}

export interface SlackAuthTestResponse {
  ok: boolean
  url: string
  team: string
  user: string
  team_id: string
  user_id: string
}
