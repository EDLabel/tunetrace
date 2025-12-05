const mongoose = require('mongoose');

const favoriteConcertSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    concertId: {
        type: String,
        required: true
    },
    concertData: {
        type: Object,
        required: true
    },
    favoritedAt: {
        type: Date,
        default: Date.now
    }
});

// Compound index to ensure unique favorites per user
favoriteConcertSchema.index({ userId: 1, concertId: 1 }, { unique: true });

module.exports = mongoose.model('FavoriteConcert', favoriteConcertSchema);