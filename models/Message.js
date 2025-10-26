const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['text', 'image', 'system'],
    default: 'text'
  },
  is_read: {
    type: Boolean,
    default: false
  },
  delivered: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Method to get message data
messageSchema.methods.getMessageData = function(currentUserId) {
  return {
    id: this._id,
    text: this.message,
    type: this.type,
    isMe: this.sender._id.toString() === currentUserId.toString(),
    timestamp: this.createdAt,
    isDelivered: this.delivered,
    isRead: this.is_read,
    sender: {
      id: this.sender._id,
      name: this.sender.name
    }
  };
};

module.exports = mongoose.model('Message', messageSchema);