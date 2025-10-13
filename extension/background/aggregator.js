/**
 * CLAUDE TOKEN TRACKER - AGGREGATOR
 * Calculates chat-level and global statistics
 */

const Aggregator = {
  
  /**
   * Calculate chat statistics from rounds
   * @param {Array} rounds - Array of round objects
   * @returns {object} - Chat statistics
   */
  calculateChatStats(rounds) {
    const stats = {
      totalRounds: rounds.length,
      totalChars: 0,
      totalTokens: 0,
      
      userChars: 0,
      userTokens: 0,
      
      docChars: 0,
      docTokens: 0,
      
      thinkingChars: 0,
      thinkingTokens: 0,
      
      assistantChars: 0,
      assistantTokens: 0,
      
      toolChars: 0,
      toolTokens: 0,
      
      modelBreakdown: {}
    };
    
    rounds.forEach(round => {
      // User data
      stats.userChars += round.user?.chars || 0;
      stats.userTokens += round.user?.tokens || 0;
      
      // Documents
      stats.docChars += round.documents?.chars || 0;
      stats.docTokens += round.documents?.tokens || 0;
      
      // Thinking
      stats.thinkingChars += round.thinking?.chars || 0;
      stats.thinkingTokens += round.thinking?.tokens || 0;
      
      // Assistant
      stats.assistantChars += round.assistant?.chars || 0;
      stats.assistantTokens += round.assistant?.tokens || 0;
      
      // Tool content
      stats.toolChars += round.toolContent?.chars || 0;
      stats.toolTokens += round.toolContent?.tokens || 0;
      
      // Total
      stats.totalChars += round.total?.chars || 0;
      stats.totalTokens += round.total?.tokens || 0;
      
      // Model breakdown
      const model = round.model || 'unknown';
      if (!stats.modelBreakdown[model]) {
        stats.modelBreakdown[model] = {
          rounds: 0,
          tokens: 0,
          roundsWithThinking: 0
        };
      }
      stats.modelBreakdown[model].rounds++;
      stats.modelBreakdown[model].tokens += round.total?.tokens || 0;
      if (round.hasThinking) {
        stats.modelBreakdown[model].roundsWithThinking++;
      }
    });
    
    return stats;
  },
  
  /**
   * Calculate global statistics from all chats
   * @param {object} chats - All chats object
   * @returns {object} - Global statistics
   */
  calculateGlobalStats(chats) {
    const stats = {
      totalChats: Object.keys(chats).length,
      totalRounds: 0,
      totalTokens: 0,
      totalChars: 0,
      
      userTokens: 0,
      docTokens: 0,
      thinkingTokens: 0,
      assistantTokens: 0,
      toolTokens: 0,
      
      modelBreakdown: {},
      
      chatsByType: {
        project: 0,
        chat: 0,
        unknown: 0
      }
    };
    
    Object.values(chats).forEach(chat => {
      // Chat type count
      stats.chatsByType[chat.type] = (stats.chatsByType[chat.type] || 0) + 1;
      
      // Aggregate from chat stats
      if (chat.stats) {
        stats.totalRounds += chat.stats.totalRounds || 0;
        stats.totalTokens += chat.stats.totalTokens || 0;
        stats.totalChars += chat.stats.totalChars || 0;
        
        stats.userTokens += (chat.stats.userTokens || 0) + (chat.stats.docTokens || 0);
        stats.thinkingTokens += chat.stats.thinkingTokens || 0;
        stats.assistantTokens += chat.stats.assistantTokens || 0;
        stats.toolTokens += chat.stats.toolTokens || 0;
        
        // Model breakdown
        if (chat.stats.modelBreakdown) {
          Object.entries(chat.stats.modelBreakdown).forEach(([model, data]) => {
            if (!stats.modelBreakdown[model]) {
              stats.modelBreakdown[model] = {
                rounds: 0,
                tokens: 0,
                roundsWithThinking: 0
              };
            }
            stats.modelBreakdown[model].rounds += data.rounds || 0;
            stats.modelBreakdown[model].tokens += data.tokens || 0;
            stats.modelBreakdown[model].roundsWithThinking += data.roundsWithThinking || 0;
          });
        }
      }
    });
    
    return stats;
  },
  
  /**
   * Get chats filtered by time range
   * @param {object} chats - All chats
   * @param {string} range - Time range ('4h', 'today', 'week', 'all')
   * @returns {Array} - Filtered chat array
   */
  getFilteredChats(chats, range = 'all') {
    const now = Date.now();
    const chatArray = Object.values(chats);
    
    switch (range) {
      case '4h':
        const fourHoursAgo = now - (4 * 60 * 60 * 1000);
        return chatArray.filter(chat => {
          return Date.parse(chat.lastActive) >= fourHoursAgo;
        });
      
      case 'today':
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        return chatArray.filter(chat => {
          return Date.parse(chat.lastActive) >= todayStart.getTime();
        });
      
      case 'week':
        const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
        return chatArray.filter(chat => {
          return Date.parse(chat.lastActive) >= weekAgo;
        });
      
      case 'all':
      default:
        return chatArray;
    }
  },
  
  /**
   * Get top chats by token usage
   * @param {object} chats - All chats
   * @param {number} limit - Number of chats to return
   * @returns {Array} - Sorted chat array
   */
  getTopChats(chats, limit = 10) {
    return Object.values(chats)
      .sort((a, b) => (b.stats?.totalTokens || 0) - (a.stats?.totalTokens || 0))
      .slice(0, limit);
  },
  
  /**
   * Get recent chats
   * @param {object} chats - All chats
   * @param {number} limit - Number of chats to return
   * @returns {Array} - Sorted chat array
   */
  getRecentChats(chats, limit = 10) {
    return Object.values(chats)
      .sort((a, b) => Date.parse(b.lastActive) - Date.parse(a.lastActive))
      .slice(0, limit);
  },
  
  /**
   * Search chats by title
   * @param {object} chats - All chats
   * @param {string} query - Search query
   * @returns {Array} - Matching chats
   */
  searchChats(chats, query) {
    const lowerQuery = query.toLowerCase();
    return Object.values(chats).filter(chat => {
      return chat.title.toLowerCase().includes(lowerQuery);
    });
  }
};

// Export for use in service worker
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Aggregator;
}