const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 80
  },
  description: {
    type: String,
    maxlength: 500,
    default: ''
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: String,
    required: true
  },
  condition: {
    type: String,
    required: true,
    enum: ['New', 'Like New', 'Good', 'Fair', 'Poor']
  },
  images: [{
    url: String,
    path: String,
    is_primary: {
      type: Boolean,
      default: false
    }
  }],
  location: {
    address: String,
    coordinates: {
      lat: Number,
      lng: Number
    },
    show_on_map: {
      type: Boolean,
      default: true
    }
  },
  contact_preferences: {
    show_phone: {
      type: Boolean,
      default: true
    },
    preferred_contact: {
      type: String,
      enum: ['Messages', 'Phone', 'Both'],
      default: 'Both'
    },
    phone_number: String
  },
  is_negotiable: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'sold', 'expired', 'deleted'],
    default: 'draft'
  },
  views: {
    type: Number,
    default: 0
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expires_at: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    }
  }
}, {
  timestamps: true
});

// Method to get product data for frontend
productSchema.methods.getProductData = function() {
  return {
    id: this._id,
    title: this.title,
    description: this.description,
    price: this.price,
    formattedPrice: `$${this.price}`,
    category: this.category,
    condition: this.condition,
    images: this.images,
    imageUrl: this.images.length > 0 ? this.images[0].url : null,
    location: this.location,
    contact_preferences: this.contact_preferences,
    is_negotiable: this.is_negotiable,
    status: this.status,
    views: this.views,
    seller: this.seller,
    created_at: this.createdAt,
    updated_at: this.updatedAt,
    expires_at: this.expires_at
  };
};

module.exports = mongoose.model('Product', productSchema);