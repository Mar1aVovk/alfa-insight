import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const cache = sqliteTable('insight_cache', {
  key: text('key').primaryKey(),
  payload: text('payload').notNull(),
  expiresAt: integer('expires_at').notNull(),
});
export const feedback = sqliteTable('feedback', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull(),
  companyId: text('company_id').notNull(),
  newsId: text('news_id').notNull(),
  verdict: text('verdict').notNull(),
  createdAt: integer('created_at').notNull(),
});
export const usage = sqliteTable('usage', {
  day: text('day').primaryKey(),
  calls: integer('calls').notNull().default(0),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
});
