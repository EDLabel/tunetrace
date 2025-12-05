const mongoose = require('mongoose');

const trackedArtistSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    artistId: {
        type: String,
        required: true
    },
    artistName: {
        type: String,
        required: true
    },
    artistImage: String,
    genre: String,
    trackedAt: {
        type: Date,
        default: Date.now
    }
});

// Compound index to ensure unique tracking per user
trackedArtistSchema.index({ userId: 1, artistId: 1 }, { unique: true });

module.exports = mongoose.model('TrackedArtist', trackedArtistSchema);