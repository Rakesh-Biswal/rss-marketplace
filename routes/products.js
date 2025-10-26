const express = require('express');
const auth = require('../middleware/auth');
const Product = require('../models/Product');
const router = express.Router();

// Create new product (draft or active)
router.post('/', auth, async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      category,
      condition,
      images,
      location,
      contact_preferences,
      is_negotiable,
      status = 'draft'
    } = req.body;

    // Validation
    if (!title || !price || !category || !condition) {
      return res.status(400).json({
        status: 'error',
        message: 'Title, price, category, and condition are required'
      });
    }

    if (price < 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Price cannot be negative'
      });
    }

    // Create product
    const product = new Product({
      title: title.trim(),
      description: description ? description.trim() : '',
      price: parseFloat(price),
      category,
      condition,
      images: images || [],
      location: location || {},
      contact_preferences: contact_preferences || {},
      is_negotiable: Boolean(is_negotiable),
      status,
      seller: req.user.userId
    });

    await product.save();
    await product.populate('seller', 'name phone rating review_count');

    res.status(201).json({
      status: 'success',
      message: status === 'draft' ? 'Draft saved successfully' : 'Product posted successfully',
      data: {
        product: product.getProductData()
      }
    });

  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Get user's drafts
router.get('/drafts', auth, async (req, res) => {
  try {
    const drafts = await Product.find({
      seller: req.user.userId,
      status: 'draft'
    }).populate('seller', 'name phone')
      .sort({ updatedAt: -1 });

    res.status(200).json({
      status: 'success',
      data: {
        drafts: drafts.map(draft => draft.getProductData())
      }
    });

  } catch (error) {
    console.error('Get drafts error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Get user's active products
router.get('/my-products', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const products = await Product.find({
      seller: req.user.userId,
      status: { $in: ['active', 'sold'] }
    })
      .populate('seller', 'name phone rating review_count')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments({
      seller: req.user.userId,
      status: { $in: ['active', 'sold'] }
    });

    res.status(200).json({
      status: 'success',
      data: {
        products: products.map(product => product.getProductData()),
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total
      }
    });

  } catch (error) {
    console.error('Get my products error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Update product
router.put('/:id', auth, async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      seller: req.user.userId
    });

    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found'
      });
    }

    const allowedUpdates = [
      'title', 'description', 'price', 'category', 'condition',
      'images', 'location', 'contact_preferences', 'is_negotiable', 'status'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        product[field] = req.body[field];
      }
    });

    await product.save();
    await product.populate('seller', 'name phone rating review_count');

    res.status(200).json({
      status: 'success',
      message: 'Product updated successfully',
      data: {
        product: product.getProductData()
      }
    });

  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Delete product (soft delete)
router.delete('/:id', auth, async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      seller: req.user.userId
    });

    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found'
      });
    }

    product.status = 'deleted';
    await product.save();

    res.status(200).json({
      status: 'success',
      message: 'Product deleted successfully'
    });

  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});






// Get products with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      minPrice,
      maxPrice,
      condition,
      location,
      radius,
      search
    } = req.query;

    // Build query
    const query = { status: 'active' };

    if (category && category !== 'All') {
      query.category = category;
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    if (condition && condition !== 'All') {
      query.condition = condition;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const products = await Product.find(query)
      .populate('seller', 'name rating review_count')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(query);

    // Format products for frontend
    // In the get products route, update the response formatting:
    const formattedProducts = products.map(product => {
      const productData = product.getProductData();
      return {
        id: productData.id,
        title: productData.title,
        price: productData.price, // Keep as number for filtering
        description: productData.description,
        category: productData.category,
        condition: productData.condition,
        images: productData.images,
        location: productData.location?.address || 'Unknown Location',
        seller: productData.seller,
        views: productData.views,
        status: productData.status,
        createdAt: productData.created_at,
        isFavorite: false // Always false initially, frontend will handle user favorites
      };
    });

    res.status(200).json({
      status: 'success',
      data: {
        products: formattedProducts,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        total
      }
    });

  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Get related products - IMPROVED VERSION
router.get('/related/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { limit = 4 } = req.query;

    console.log('Fetching related products for:', productId);

    // First, get the current product to know its category
    const currentProduct = await Product.findById(productId);

    if (!currentProduct) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found'
      });
    }

    // Find related products in the same category, excluding the current product
    const relatedProducts = await Product.find({
      _id: { $ne: productId }, // Exclude current product
      category: currentProduct.category,
      status: 'active'
    })
      .populate('seller', 'name rating review_count profile_picture')
      .sort({
        views: -1, // Sort by popularity first
        createdAt: -1 // Then by newest
      })
      .limit(parseInt(limit));

    console.log(`Found ${relatedProducts.length} related products`);

    // Format the response more carefully
    const formattedProducts = relatedProducts.map(product => {
      try {
        const productData = product.toObject ? product.toObject() : product;

        return {
          id: productData._id ? productData._id.toString() : '',
          title: productData.title || 'Untitled',
          price: productData.price || 0,
          category: productData.category || 'General',
          condition: productData.condition || 'Good',
          images: productData.images || [],
          location: productData.location?.address || 'Unknown Location',
          seller: productData.seller || {},
          views: productData.views || 0,
          status: productData.status || 'active',
          createdAt: productData.createdAt || productData.created_at,
          distance: '2.3 km'
        };
      } catch (error) {
        console.error('Error formatting product:', error);
        return null;
      }
    }).filter(product => product !== null); // Remove any null products

    res.status(200).json({
      status: 'success',
      data: {
        products: formattedProducts,
        total: formattedProducts.length
      }
    });

  } catch (error) {
    console.error('Get related products error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});


router.patch('/:id/view', async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        views: product.views
      }
    });

  } catch (error) {
    console.error('Increment views error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

router.post('/:id/favorite', async (req, res) => {
  try {
    // You'll need to implement proper favorite functionality
    // This is a placeholder implementation
    res.status(200).json({
      status: 'success',
      message: 'Favorite status updated'
    });

  } catch (error) {
    console.error('Toggle favorite error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Add categories route
router.get('/categories', async (req, res) => {
  try {
    const categories = await Product.distinct('category', { status: 'active' });

    res.status(200).json({
      status: 'success',
      data: {
        categories: ['All', ...categories]
      }
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Search products with suggestions
router.get('/search', async (req, res) => {
  try {
    const { 
      query, 
      page = 1, 
      limit = 20,
      category,
      minPrice,
      maxPrice,
      condition
    } = req.query;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Search query is required'
      });
    }

    // Build search query
    const searchQuery = {
      status: 'active',
      $or: [
        { title: { $regex: query.trim(), $options: 'i' } },
        { description: { $regex: query.trim(), $options: 'i' } },
        { category: { $regex: query.trim(), $options: 'i' } },
        { 'location.address': { $regex: query.trim(), $options: 'i' } }
      ]
    };

    // Add filters if provided
    if (category && category !== 'All') {
      searchQuery.category = { $regex: category, $options: 'i' };
    }

    if (condition) {
      searchQuery.condition = condition;
    }

    if (minPrice || maxPrice) {
      searchQuery.price = {};
      if (minPrice) searchQuery.price.$gte = parseFloat(minPrice);
      if (maxPrice) searchQuery.price.$lte = parseFloat(maxPrice);
    }

    const products = await Product.find(searchQuery)
      .populate('seller', 'name rating review_count profile_picture member_since')
      .sort({ 
        // Prioritize title matches over description matches
        createdAt: -1 
      })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments(searchQuery);

    // Get search suggestions based on popular categories and titles
    const suggestions = await Product.aggregate([
      {
        $match: {
          status: 'active',
          $or: [
            { title: { $regex: query.trim(), $options: 'i' } },
            { category: { $regex: query.trim(), $options: 'i' } }
          ]
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          sampleTitles: { $push: '$title' }
        }
      },
      {
        $project: {
          category: '$_id',
          count: 1,
          sampleTitles: { $slice: ['$sampleTitles', 3] } // Get 3 sample titles
        }
      },
      { $limit: 5 } // Limit to 5 categories
    ]);

    const formattedProducts = products.map(product => {
      const productData = product.getProductData();
      return {
        id: productData.id,
        title: productData.title,
        price: productData.price,
        description: productData.description,
        category: productData.category,
        condition: productData.condition,
        imageUrl: productData.images.length > 0 ? productData.images[0].url : null,
        location: productData.location?.address || 'Unknown Location',
        seller: productData.seller,
        views: productData.views,
        status: productData.status,
        createdAt: productData.created_at,
        isFavorite: false,
        isNegotiable: productData.is_negotiable
      };
    });

    res.status(200).json({
      status: 'success',
      data: {
        products: formattedProducts,
        suggestions: suggestions,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        total,
        searchQuery: query.trim()
      }
    });

  } catch (error) {
    console.error('Search products error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Get search suggestions for autocomplete
router.get('/search/suggestions', async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(200).json({
        status: 'success',
        data: {
          suggestions: [],
          popularSearches: []
        }
      });
    }

    // Get title suggestions
    const titleSuggestions = await Product.find({
      status: 'active',
      title: { $regex: query.trim(), $options: 'i' }
    })
    .select('title category price images')
    .limit(5)
    .sort({ views: -1 });

    // Get category suggestions
    const categorySuggestions = await Product.aggregate([
      {
        $match: {
          status: 'active',
          category: { $regex: query.trim(), $options: 'i' }
        }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      { $limit: 3 }
    ]);

    // Get popular searches (you might want to store this separately)
    const popularSearches = await Product.aggregate([
      { $match: { status: 'active' } },
      { $sample: { size: 5 } },
      { $project: { title: 1, category: 1 } }
    ]);

    const suggestions = {
      titles: titleSuggestions.map(p => ({
        type: 'product',
        title: p.title,
        category: p.category,
        price: p.price,
        image: p.images.length > 0 ? p.images[0].url : null
      })),
      categories: categorySuggestions.map(c => ({
        type: 'category',
        name: c._id,
        count: c.count
      }))
    };

    res.status(200).json({
      status: 'success',
      data: {
        suggestions: suggestions,
        popularSearches: popularSearches.slice(0, 3).map(p => p.title)
      }
    });

  } catch (error) {
    console.error('Search suggestions error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});


// Get product by ID
// In your product routes, update the getProductData method or the response formatting
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('seller', 'name phone rating review_count _id member_since location profile_picture');

    if (!product || product.status !== 'active') {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found'
      });
    }

    // Format the product data to ensure seller ID is included
    const productData = product.getProductData();

    // Ensure seller data includes both id and _id
    if (productData.seller) {
      productData.seller.id = productData.seller._id || productData.seller.id;
    }

    res.status(200).json({
      status: 'success',
      data: {
        product: productData
      }
    });

  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

module.exports = router;