const express = require('express');
const auth = require('../middleware/auth');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Product = require('../models/Product');
const User = require('../models/User');
const router = express.Router();

// Start or get conversation
// Start or get conversation
router.post('/start', auth, async (req, res) => {
  try {
    const { product_id, receiver_id, initial_message } = req.body;
    const currentUserId = req.user.userId;

    console.log('Starting conversation request:');
    console.log('Current User ID:', currentUserId);
    console.log('Product ID:', product_id);
    console.log('Receiver ID:', receiver_id);
    console.log('Initial Message:', initial_message);

    // Validate required fields
    if (!product_id || !receiver_id) {
      console.log('Missing required fields');
      return res.status(400).json({
        status: 'error',
        message: 'Product ID and receiver ID are required'
      });
    }

    // Check if product exists
    const product = await Product.findById(product_id);
    if (!product) {
      console.log('Product not found:', product_id);
      return res.status(404).json({
        status: 'error',
        message: 'Product not found'
      });
    }

    // Check if receiver exists
    const receiver = await User.findById(receiver_id);
    if (!receiver) {
      console.log('Receiver not found:', receiver_id);
      return res.status(404).json({
        status: 'error',
        message: 'Receiver not found'
      });
    }

    console.log('Product and receiver found, checking for existing conversation...');

    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      product: product_id,
      participants: {
        $all: [
          { $elemMatch: { user: currentUserId } },
          { $elemMatch: { user: receiver_id } }
        ]
      }
    })
      .populate('participants.user', 'name profile_picture')
      .populate('product', 'title price images');

    if (conversation) {
      console.log('Existing conversation found:', conversation._id);
    } else {
      console.log('No existing conversation found, creating new one...');
      // Create new conversation
      conversation = new Conversation({
        participants: [
          { user: currentUserId },
          { user: receiver_id }
        ],
        product: product_id
      });

      await conversation.save();
      await conversation.populate('participants.user', 'name profile_picture');
      await conversation.populate('product', 'title price images');
      console.log('New conversation created:', conversation._id);
    }

    // Send initial message if provided
    if (initial_message) {
      console.log('Sending initial message:', initial_message);
      const message = new Message({
        conversation: conversation._id,
        sender: currentUserId,
        message: initial_message,
        type: 'text',
        delivered: true
      });

      await message.save();

      // Update conversation last message
      conversation.last_message = initial_message;
      conversation.last_message_at = new Date();
      await conversation.save();
      console.log('Initial message sent and conversation updated');
    }

    const responseData = conversation.getConversationData(currentUserId);
    console.log('Sending response with conversation:', responseData);

    res.status(200).json({
      status: 'success',
      data: {
        conversation: responseData
      }
    });

  } catch (error) {
    console.error('Start conversation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error: ' + error.message
    });
  }
});

// Get user conversations
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const currentUserId = req.user.userId;

    const conversations = await Conversation.find({
      'participants.user': currentUserId
    })
      .populate('participants.user', 'name profile_picture')
      .populate('product', 'title price images')
      .sort({ last_message_at: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const formattedConversations = conversations.map(conv =>
      conv.getConversationData(currentUserId)
    );

    res.status(200).json({
      status: 'success',
      data: {
        conversations: formattedConversations
      }
    });

  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Ensure you have this route
router.get('/conversations/:conversationId/messages', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    console.log('Fetching messages for conversation:', conversationId);
    
    // Your message fetching logic here
    const messages = await Message.find({ conversation_id: conversationId })
      .sort({ created_at: 1 });
    
    res.status(200).json({
      status: 'success',
      data: { messages }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Get conversation messages
router.get('/:id/messages', auth, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const conversationId = req.params.id;
    const currentUserId = req.user.userId;

    // Verify user is participant in conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      'participants.user': currentUserId
    });

    if (!conversation) {
      return res.status(404).json({
        status: 'error',
        message: 'Conversation not found'
      });
    }

    const messages = await Message.find({ conversation: conversationId })
      .populate('sender', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const formattedMessages = messages.map(msg =>
      msg.getMessageData(currentUserId)
    ).reverse(); // Reverse to show oldest first

    res.status(200).json({
      status: 'success',
      data: {
        messages: formattedMessages,
        totalPages: Math.ceil(messages.length / limit),
        currentPage: parseInt(page),
        total: messages.length
      }
    });

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Send message
router.post('/:id/messages', auth, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const { message, type = 'text' } = req.body;
    const currentUserId = req.user.userId;

    if (!message) {
      return res.status(400).json({
        status: 'error',
        message: 'Message content is required'
      });
    }

    // Verify user is participant in conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      'participants.user': currentUserId
    });

    if (!conversation) {
      return res.status(404).json({
        status: 'error',
        message: 'Conversation not found'
      });
    }

    // Create message
    const newMessage = new Message({
      conversation: conversationId,
      sender: currentUserId,
      message: message,
      type: type,
      delivered: true
    });

    await newMessage.save();
    await newMessage.populate('sender', 'name');

    // Update conversation
    conversation.last_message = message;
    conversation.last_message_at = new Date();

    // Increment unread count for other participants
    conversation.participants.forEach(participant => {
      if (participant.user.toString() !== currentUserId) {
        conversation.unread_count += 1;
      }
    });

    await conversation.save();

    res.status(201).json({
      status: 'success',
      data: {
        message: newMessage.getMessageData(currentUserId)
      }
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Mark messages as read
router.put('/:id/read', auth, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const currentUserId = req.user.userId;

    // Update conversation participant's last_read
    await Conversation.updateOne(
      {
        _id: conversationId,
        'participants.user': currentUserId
      },
      {
        $set: {
          'participants.$.last_read': new Date(),
          unread_count: 0
        }
      }
    );

    // Mark messages as read
    await Message.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: currentUserId },
        is_read: false
      },
      {
        $set: { is_read: true }
      }
    );

    res.status(200).json({
      status: 'success',
      message: 'Messages marked as read'
    });

  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Get conversation details
router.get('/:id', auth, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const currentUserId = req.user.userId;

    console.log('Getting conversation details for:', conversationId);

    const conversation = await Conversation.findOne({
      _id: conversationId,
      'participants.user': currentUserId
    })
    .populate('participants.user', 'name profile_picture phone rating review_count member_since')
    .populate('product', 'title price images condition category');

    if (!conversation) {
      console.log('Conversation not found:', conversationId);
      return res.status(404).json({
        status: 'error',
        message: 'Conversation not found'
      });
    }

    console.log('Conversation found, sending response');

    // Ensure we're returning a single conversation object
    const conversationData = conversation.getConversationData(currentUserId);
    
    res.status(200).json({
      status: 'success',
      data: {
        conversation: conversationData  // Ensure this is a single object, not array
      }
    });

  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error: ' + error.message
    });
  }
});


// Delete conversation
router.delete('/:id', auth, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const currentUserId = req.user.userId;

    // Verify user is participant in conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      'participants.user': currentUserId
    });

    if (!conversation) {
      return res.status(404).json({
        status: 'error',
        message: 'Conversation not found'
      });
    }

    // Delete all messages in the conversation
    await Message.deleteMany({ conversation: conversationId });

    // Delete the conversation
    await Conversation.findByIdAndDelete(conversationId);

    res.status(200).json({
      status: 'success',
      message: 'Conversation deleted successfully'
    });

  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Block conversation (placeholder - implement your blocking logic)
router.post('/:id/block', auth, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const currentUserId = req.user.userId;

    // Verify user is participant in conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      'participants.user': currentUserId
    });

    if (!conversation) {
      return res.status(404).json({
        status: 'error',
        message: 'Conversation not found'
      });
    }

    // Implement your blocking logic here
    // This could involve updating a blocked_users collection
    // or adding a blocked field to the conversation

    res.status(200).json({
      status: 'success',
      message: 'Conversation blocked successfully'
    });

  } catch (error) {
    console.error('Block conversation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Unblock conversation (placeholder - implement your unblocking logic)
router.post('/:id/unblock', auth, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const currentUserId = req.user.userId;

    // Verify user is participant in conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      'participants.user': currentUserId
    });

    if (!conversation) {
      return res.status(404).json({
        status: 'error',
        message: 'Conversation not found'
      });
    }

    // Implement your unblocking logic here

    res.status(200).json({
      status: 'success',
      message: 'Conversation unblocked successfully'
    });

  } catch (error) {
    console.error('Unblock conversation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

module.exports = router;