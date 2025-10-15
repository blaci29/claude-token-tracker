/**
 * Aggregator - Statistics and data aggregation
 */

import { CONSTANTS } from '../shared/constants.module.js';

export const Aggregator = {
  /**
   * Calculate stats for a single chat
   */
  calculateChatStats(rounds) {
    if (!rounds || rounds.length === 0) {
      return {
        totalRounds: 0,
        totalTokens: 0,
        totalChars: 0,
        byType: {}
      };
    }

    // ⚠️ CRITICAL: Only count successful rounds (skip errors)
    const successfulRounds = rounds.filter(round => !round.error);

    const stats = {
      totalRounds: successfulRounds.length, // Only successful rounds
      totalTokens: 0,
      totalChars: 0,
      byType: {
        user: { tokens: 0, chars: 0 },
        documents: { tokens: 0, chars: 0, count: 0 },
        thinking: { tokens: 0, chars: 0 },
        assistant: { tokens: 0, chars: 0 },
        toolContent: { tokens: 0, chars: 0 }
      },
      byModel: {}
    };

    successfulRounds.forEach(round => {
      // Total
      stats.totalTokens += round.total.tokens;
      stats.totalChars += round.total.chars;

      // By type
      stats.byType.user.tokens += round.user.tokens;
      stats.byType.user.chars += round.user.chars;
      stats.byType.documents.tokens += round.documents.tokens;
      stats.byType.documents.chars += round.documents.chars;
      stats.byType.documents.count += round.documents.count || 0;
      stats.byType.thinking.tokens += round.thinking.tokens;
      stats.byType.thinking.chars += round.thinking.chars;
      stats.byType.assistant.tokens += round.assistant.tokens;
      stats.byType.assistant.chars += round.assistant.chars;
      stats.byType.toolContent.tokens += round.toolContent.tokens;
      stats.byType.toolContent.chars += round.toolContent.chars;

      // By model
      const model = round.model || 'unknown';
      if (!stats.byModel[model]) {
        stats.byModel[model] = { tokens: 0, chars: 0, rounds: 0 };
      }
      stats.byModel[model].tokens += round.total.tokens;
      stats.byModel[model].chars += round.total.chars;
      stats.byModel[model].rounds += 1;
    });

    return stats;
  },

  /**
   * Calculate global stats across all chats
   */
  calculateGlobalStats(chats) {
    const stats = {
      totalChats: 0,
      totalRounds: 0,
      totalTokens: 0,
      totalChars: 0,
      byType: {
        user: { tokens: 0, chars: 0 },
        documents: { tokens: 0, chars: 0, count: 0 },
        thinking: { tokens: 0, chars: 0 },
        assistant: { tokens: 0, chars: 0 },
        toolContent: { tokens: 0, chars: 0 }
      },
      byModel: {},
      byChatType: {}
    };

    if (!chats) return stats;

    const chatArray = Object.values(chats);
    stats.totalChats = chatArray.length;

    chatArray.forEach(chat => {
      if (!chat.stats) return;

      stats.totalRounds += chat.stats.totalRounds || 0;
      stats.totalTokens += chat.stats.totalTokens || 0;
      stats.totalChars += chat.stats.totalChars || 0;

      // By type
      if (chat.stats.byType) {
        Object.keys(chat.stats.byType).forEach(type => {
          if (stats.byType[type]) {
            stats.byType[type].tokens += chat.stats.byType[type].tokens || 0;
            stats.byType[type].chars += chat.stats.byType[type].chars || 0;
            if (type === 'documents') {
              stats.byType[type].count += chat.stats.byType[type].count || 0;
            }
          }
        });
      }

      // By model
      if (chat.stats.byModel) {
        Object.keys(chat.stats.byModel).forEach(model => {
          if (!stats.byModel[model]) {
            stats.byModel[model] = { tokens: 0, chars: 0, rounds: 0 };
          }
          stats.byModel[model].tokens += chat.stats.byModel[model].tokens || 0;
          stats.byModel[model].chars += chat.stats.byModel[model].chars || 0;
          stats.byModel[model].rounds += chat.stats.byModel[model].rounds || 0;
        });
      }

      // By chat type
      const chatType = chat.type || CONSTANTS.CHAT_TYPES.UNKNOWN;
      if (!stats.byChatType[chatType]) {
        stats.byChatType[chatType] = { tokens: 0, chars: 0, chats: 0, rounds: 0 };
      }
      stats.byChatType[chatType].tokens += chat.stats.totalTokens || 0;
      stats.byChatType[chatType].chars += chat.stats.totalChars || 0;
      stats.byChatType[chatType].chats += 1;
      stats.byChatType[chatType].rounds += chat.stats.totalRounds || 0;
    });

    return stats;
  },

  /**
   * Filter chats by time range
   */
  getFilteredChats(chats, range) {
    if (!chats) return [];

    const chatArray = Object.values(chats);
    
    if (range === 'all') {
      return chatArray;
    }

    const now = Date.now();
    let cutoff;

    switch (range) {
      case 'today':
        cutoff = now - (24 * 60 * 60 * 1000);
        break;
      case 'week':
        cutoff = now - (7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        cutoff = now - (30 * 24 * 60 * 60 * 1000);
        break;
      default:
        return chatArray;
    }

    return chatArray.filter(chat => {
      const lastActive = new Date(chat.lastActive).getTime();
      return lastActive >= cutoff;
    });
  }
};
