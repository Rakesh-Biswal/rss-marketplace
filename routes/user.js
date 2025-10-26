const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Product = require('../models/Product');
const router = express.Router();

// Get user profile with listings and stats
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Get user's active listings
    const activeListings = await Product.find({
      seller: req.user.userId,
      status: 'active'
    })
    .select('title price category condition images views status createdAt')
    .sort({ createdAt: -1 })
    .limit(10);

    // Get user stats
    const totalListings = await Product.countDocuments({
      seller: req.user.userId,
      status: 'active'
    });

    const soldItems = await Product.countDocuments({
      seller: req.user.userId,
      status: 'sold'
    });

    const totalEarningsResult = await Product.aggregate([
      {
        $match: {
          seller: req.user.userId,
          status: 'sold'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$price' }
        }
      }
    ]);

    const totalEarnings = totalEarningsResult.length > 0 ? totalEarningsResult[0].total : 0;

    // Format listings for frontend
    const formattedListings = activeListings.map(listing => ({
      id: listing._id,
      title: listing.title,
      price: `$${listing.price}`,
      category: listing.category,
      condition: listing.condition,
      imageUrl: listing.images.length > 0 ? listing.images[0].url : null,
      views: listing.views,
      status: listing.status,
      createdAt: listing.createdAt
    }));

    // Format user data with listings and stats
    const userData = {
      ...user.getProfile(),
      listings: formattedListings,
      stats: {
        itemsSold: soldItems,
        itemsListed: totalListings,
        responseRate: user.stats?.response_rate || 0,
        totalEarnings: totalEarnings
      }
    };

    res.status(200).json({
      status: 'success',
      data: {
        user: userData
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, email, location, profile_picture } = req.body;
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Update fields if provided
    const updates = {};
    if (name) updates.name = name;
    if (email) {
      // Check if email is unique
      if (email !== user.email) {
        const emailExists = await User.emailExists(email);
        if (emailExists) {
          return res.status(400).json({
            status: 'error',
            message: 'Email already registered'
          });
        }
        updates.email = email.toLowerCase();
      }
    }
    if (location !== undefined) updates.location = location;
    if (profile_picture !== undefined) updates.profile_picture = profile_picture;

    // Recalculate profile completion
    let completion = 30; // Base for phone and name
    if (updates.email || user.email) completion += 20;
    if (updates.location || user.location) completion += 20;
    if (updates.profile_picture || user.profile_picture) completion += 30;
    updates.profile_completion = Math.min(completion, 100);

    // Apply updates
    Object.keys(updates).forEach(key => {
      user[key] = updates[key];
    });

    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      data: {
        user: user.getProfile()
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        status: 'error',
        message: 'Email already exists'
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Get user listings with pagination
router.get('/listings', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    
    const query = {
      seller: req.user.userId
    };
    
    if (status && status !== 'all') {
      query.status = status;
    }

    const listings = await Product.find(query)
      .select('title price category condition images views status createdAt')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(query);

    const formattedListings = listings.map(listing => ({
      id: listing._id,
      title: listing.title,
      price: `$${listing.price}`,
      category: listing.category,
      condition: listing.condition,
      imageUrl: listing.images.length > 0 ? listing.images[0].url : null,
      views: listing.views,
      status: listing.status,
      createdAt: listing.createdAt
    }));

    res.status(200).json({
      status: 'success',
      data: {
        listings: formattedListings,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        total
      }
    });

  } catch (error) {
    console.error('Get user listings error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

module.exports = router;