const mongoose = require('mongoose');

const pushTokenSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    expoPushToken: {
        type: String,
        required: true,
        unique: true
    },
    deviceId: {
        type: String,
        required: true
    },
    platform: {
        type: String,
        enum: ['ios', 'android', 'web'],
        required: true
    },
    active: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Compound index for user and device
pushTokenSchema.index({ userId: 1, deviceId: 1 }, { unique: true });

module.exports = mongoose.model('PushToken', pushToken);