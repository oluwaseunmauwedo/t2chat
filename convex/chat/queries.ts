// QUERIES - for real-time subscriptions
import { action, mutation, query } from '../_generated/server'
import { api } from '../_generated/api'
import { betterAuthComponent } from '../auth'
import { v } from 'convex/values'
import { Id } from '../_generated/dataModel'

export const getChatMessages = query({
  args: { chatId: v.id('chats') },
  handler: async (ctx, { chatId }) => {
    // Check authentication
    const userId = await betterAuthComponent.getAuthUserId(ctx)
    if (!userId) {
      throw new Error('Authentication required')
    }

    // Verify chat ownership
    const chat = await ctx.db.get(chatId)
    if (!chat || chat.userId !== userId) {
      throw new Error('Chat not found or access denied')
    }

    // Get messages ordered by creation time
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_chat_created', (q) => q.eq('chatId', chatId))
      .order('asc')
      .collect()

    return messages
  },
})

export const getMessage = query({
  args: { messageId: v.id('messages') },
  handler: async (ctx, { messageId }) => {
    const userId = await betterAuthComponent.getAuthUserId(ctx)
    if (!userId) {
      throw new Error('Authentication required')
    }

    const message = await ctx.db.get(messageId)
    if (!message) {
      return null
    }

    // Verify chat ownership
    const chat = await ctx.db.get(message.chatId)
    if (!chat || chat.userId !== userId) {
      throw new Error('Access denied')
    }

    return message
  },
})

export const getUserChats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await betterAuthComponent.getAuthUserId(ctx)
    if (!userId) {
      throw new Error('Authentication required')
    }

    const chats = await ctx.db
      .query('chats')
      .withIndex('by_user', (q) => q.eq('userId', userId as Id<'users'>))
      .order('desc')
      .collect()

    return chats
  },
})

export const getChat = query({
  args: { chatId: v.id('chats') },
  handler: async (ctx, { chatId }) => {
    const userId = await betterAuthComponent.getAuthUserId(ctx)
    if (!userId) {
      throw new Error('Authentication required')
    }

    const chat = await ctx.db.get(chatId)
    if (!chat || chat.userId !== userId) {
      throw new Error('Chat not found or access denied')
    }

    return chat
  },
})

export const getUserAttachments = query({
  args: {},
  handler: async (ctx) => {
    const userId = await betterAuthComponent.getAuthUserId(ctx)
    if (!userId) {
      return []
    }

    const chats = await ctx.db
      .query('chats')
      .withIndex('by_user', (q) => q.eq('userId', userId as Id<'users'>))
      .collect()

    const chatIds = chats.map((c) => c._id)
    const allAttachments: any[] = []

    for (const chatId of chatIds) {
      const messages = await ctx.db
        .query('messages')
        .withIndex('by_chat', (q) => q.eq('chatId', chatId))
        .collect()

      messages.forEach((msg) => {
        if (msg.attachments && msg.attachments.length > 0) {
          allAttachments.push(...msg.attachments)
        }
      })
    }

    return allAttachments
  },
})

export const getSharedChat = query({
  args: { shareId: v.string() },
  handler: async (ctx, { shareId }) => {
    const chat = await ctx.db
      .query('chats')
      .withIndex('by_share_id', (q) => q.eq('shareId', shareId))
      .unique()

    if (!chat || !chat.isShared) {
      return null
    }

    const messages = await ctx.db
      .query('messages')
      .withIndex('by_chat_created', (q) => q.eq('chatId', chat._id))
      .order('asc')
      .collect()

    return { chat, messages }
  },
})

export const listChats = query({
  args: {
    isBranch: v.optional(v.boolean()),
  },
  handler: async (ctx, { isBranch }) => {
    const userId = await betterAuthComponent.getAuthUserId(ctx)
    if (!userId) {
      return []
    }
    const chats = await ctx.db
      .query('chats')
      .withIndex('by_user', (q) => q.eq('userId', userId as Id<'users'>))
      .filter((q) => q.eq(q.field('isBranch'), isBranch))
      .order('desc')
      .collect()

    return Promise.all(
      chats.map(async (chat) => {
        const lastMessage = await ctx.db
          .query('messages')
          .withIndex('by_chat', (q) => q.eq('chatId', chat._id))
          .order('desc')
          .first()
        return {
          ...chat,
          lastMessageContent: lastMessage?.content,
          lastMessageTimestamp: lastMessage?._creationTime,
        }
      }),
    )
  },
})

export const exportAllConversations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await betterAuthComponent.getAuthUserId(ctx)
    if (!userId) {
      throw new Error('Authentication required')
    }

    const chats = await ctx.db
      .query('chats')
      .withIndex('by_user', (q) => q.eq('userId', userId as Id<'users'>))
      .collect()

    const allMessages = await Promise.all(
      chats.map((chat) =>
        ctx.db
          .query('messages')
          .withIndex('by_chat', (q) => q.eq('chatId', chat._id))
          .collect(),
      ),
    )

    return {
      chats,
      messages: allMessages.flat(),
    }
  },
})
