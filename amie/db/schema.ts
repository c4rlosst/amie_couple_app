import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
export const accounts=sqliteTable('accounts',{
  id:text('id').primaryKey(),username:text('username').notNull().unique(),name:text('name').notNull(),salt:text('salt').notNull(),passwordHash:text('password_hash').notNull(),createdAt:integer('created_at').notNull(),
});
export const sessions=sqliteTable('sessions',{
  tokenHash:text('token_hash').primaryKey(),accountId:text('account_id').notNull().references(()=>accounts.id),expiresAt:integer('expires_at').notNull(),
},t=>[index('sessions_expiry').on(t.expiresAt)]);
export const authAttempts=sqliteTable('auth_attempts',{
  id:text('id').primaryKey(),window:integer('window').notNull(),count:integer('count').notNull(),
},t=>[index('auth_window').on(t.window)]);
export const spaces = sqliteTable('spaces', {
  id: text('id').primaryKey(), ownerId: text('owner_id').notNull(), partnerId: text('partner_id'),
  inviteHash: text('invite_hash').unique(), inviteExpires: integer('invite_expires'), anniversary: text('anniversary'), createdAt: integer('created_at').notNull(),
});
export const members = sqliteTable('members', {
  id: text('id').primaryKey(), spaceId: text('space_id').references(() => spaces.id), name: text('name').notNull(),
  mood: text('mood').notNull().default('okay'), status: text('status').notNull().default('around'),
  statusAt: integer('status_at').notNull(), lastSeen: integer('last_seen').notNull(),
  latitude: real('latitude'), longitude: real('longitude'), accuracy: real('accuracy'), locationAt: integer('location_at'),
}, t => [index('members_space').on(t.spaceId)]);
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(), spaceId: text('space_id').notNull().references(() => spaces.id),
  senderId: text('sender_id').notNull().references(() => members.id), kind: text('kind').notNull(),
  body: text('body').notNull().default(''), fileKey: text('file_key'), mime: text('mime'), createdAt: integer('created_at').notNull(),
}, t => [index('messages_space_time').on(t.spaceId, t.createdAt)]);
