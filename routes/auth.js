const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

// Check phone existence for login
router.post('/check-phone', async (req, res) => {
  try {
    let { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        status: 'error',
        message: 'Phone number is required'
      });
    }

    if (!phone.startsWith('+91')) {
      phone = '+91' + phone;
    }

    const userExists = await User.phoneExists(phone);

    if (!userExists) {
      return res.status(404).json({
        status: 'error',
        message: 'No account found with this phone number. Please sign up first.'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Phone number exists. You can proceed with OTP.',
      data: { phone_exists: true }
    });

  } catch (error) {
    console.error('Check phone error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});


// Check user data for signup
router.post('/check-signup', async (req, res) => {
  try {
    let { phone, email } = req.body;

    if (!phone) {
      return res.status(400).json({
        status: 'error',
        message: 'Phone number is required'
      });
    }

    if (!phone.startsWith('+91')) {
      phone = '+91' + phone;
    }

    const errors = [];

    const phoneExists = await User.phoneExists(phone);
    if (phoneExists) {
      errors.push('Phone number already registered. Please sign in instead.');
    }

    if (email) {
      const emailExists = await User.emailExists(email);
      if (emailExists) {
        errors.push('Email already registered. Please use a different email.');
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: errors.join(' ')
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Phone and email are available for registration.',
      data: { can_register: true }
    });

  } catch (error) {
    console.error('Check signup error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});


// Register user after Firebase authentication
router.post('/register', async (req, res) => {
  try {
    const { firebase_uid, name, phone, email, location } = req.body;

    if (!firebase_uid || !name || !phone) {
      return res.status(400).json({
        status: 'error',
        message: 'Firebase UID, name, and phone are required'
      });
    }

    // Final check for duplicates
    const phoneExists = await User.phoneExists(phone);
    if (phoneExists) {
      return res.status(400).json({
        status: 'error',
        message: 'Phone number already registered'
      });
    }

    if (email) {
      const emailExists = await User.emailExists(email);
      if (emailExists) {
        return res.status(400).json({
          status: 'error',
          message: 'Email already registered'
        });
      }
    }

    let profileCompletion = 30;
    if (email) profileCompletion += 20;
    if (location) profileCompletion += 20;

    // Create new user
    const newUser = new User({
      firebase_uid,
      name: name.trim(),
      phone: phone.trim(),
      email: email ? email.trim().toLowerCase() : undefined,
      location: location || '',
      profile_completion: profileCompletion,
      member_since: new Date()
    });

    await newUser.save();

    // Generate JWT token
    const token = generateToken(newUser._id);

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: {
        user: newUser.getProfile(),
        token
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        status: 'error',
        message: `${field} already exists`
      });
    }

    res.status(500).json({
      status: 'error',
      message: 'Internal server error during registration'
    });
  }
});

// Login user after Firebase authentication
router.post('/login', async (req, res) => {
  try {
    const { firebase_uid, phone } = req.body;

    if (!firebase_uid || !phone) {
      return res.status(400).json({
        status: 'error',
        message: 'Firebase UID and phone are required'
      });
    }

    // Find user by phone
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found. Please sign up first.'
      });
    }

    // Update Firebase UID if different (shouldn't happen normally)
    if (user.firebase_uid !== firebase_uid) {
      user.firebase_uid = firebase_uid;
      await user.save();
    }

    // Generate JWT token
    const token = generateToken(user._id);

    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: {
        user: user.getProfile(),
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error during login'
    });
  }
});

// Verify token endpoint
router.post('/verify-token', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        status: 'error',
        message: 'Token is required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        user: user.getProfile(),
        valid: true
      }
    });

  } catch (error) {
    res.status(401).json({
      status: 'error',
      message: 'Invalid token',
      valid: false
    });
  }
});

module.exports = router;