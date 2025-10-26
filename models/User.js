const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    firebase_uid: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        sparse: true
    },
    location: {
        type: String,
        default: ''
    },
    profile_picture: {
        type: String,
        default: ''
    },
    is_verified: {
        type: Boolean,
        default: false
    },
    rating: {
        type: Number,
        default: 0
    },
    review_count: {
        type: Number,
        default: 0
    },
    member_since: {
        type: Date,
        default: Date.now
    },
    profile_completion: {
        type: Number,
        default: 0
    },
    stats: {
        items_sold: { type: Number, default: 0 },
        items_listed: { type: Number, default: 0 },
        response_rate: { type: Number, default: 0 },
        total_earnings: { type: Number, default: 0 }
    }
}, {
    timestamps: true
});

// Method to check if phone exists
userSchema.statics.phoneExists = async function (phone) {
    const user = await this.findOne({ phone });
    return !!user;
};

// Method to check if email exists
userSchema.statics.emailExists = async function (email) {
    if (!email) return false;
    const user = await this.findOne({ email });
    return !!user;
};

// Method to get user profile data
userSchema.methods.getProfile = function () {
    return {
        id: this._id,
        name: this.name,
        email: this.email,
        phone: this.phone,
        location: this.location,
        profile_picture: this.profile_picture,
        is_verified: this.is_verified,
        rating: this.rating,
        review_count: this.review_count,
        member_since: this.member_since,
        profile_completion: this.profile_completion,
        stats: this.stats
    };
};

module.exports = mongoose.model('User', userSchema);