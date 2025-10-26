const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    last_read: {
      type: Date,
      default: Date.now
    }
  }],
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  last_message: {
    type: String,
    default: ''
  },
  last_message_at: {
    type: Date,
    default: Date.now
  },
  unread_count: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Method to get conversation data
conversationSchema.methods.getConversationData = function(currentUserId) {
  const otherParticipant = this.participants.find(
    p => p.user._id.toString() !== currentUserId.toString()
  );
  
  return {
    id: this._id,
    participant: otherParticipant ? {
      id: otherParticipant.user._id,
      name: otherParticipant.user.name,
      avatar: otherParticipant.user.profile_picture
    } : null,
    product: this.product,
    last_message: this.last_message,
    last_message_at: this.last_message_at,
    unread_count: this.unread_count,
    created_at: this.createdAt,
    updated_at: this.updatedAt
  };
};

module.exports = mongoose.model('Conversation', conversationSchema);