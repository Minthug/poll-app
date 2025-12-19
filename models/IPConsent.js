const mongoose = require('mongoose');

const ipConsentSchema = new mongoose.Schema({
    ip: {
        type: String,
        required: true,
        unique: true
    },
    consentDate: {
        type: Date,
        default: Date.now
    },
    region: {
        country: String,
        city: String
    }
});

module.exports = mongoose.model('IPConsent', ipConsentSchema);