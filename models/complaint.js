const mongoose = require('mongoose');

const ComplaintSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Please add a title'],
        trim: true,
        maxlength: [100, 'Title cannot be more than 100 characters'],
    },
    category: {
        type: String,
        required: [true, 'Please select a category'],
        enum: ['Infrastructure', 'Internet', 'Cleanliness', 'Electrical', 'Furniture', 'Other'],
    },
    description: {
        type: String,
        required: [true, 'Please add a description'],
        maxlength: [1000, 'Description cannot be more than 1000 characters'],
    },
    imageUrl: {
        type: String,
        default: '',
    },
    status: {
        type: String,
        enum: ['Pending', 'In Progress', 'Resolved'],
        default: 'Pending',
    },
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    studentName: {
        type: String,
        required: true,
    },
    studentEmail: {
        type: String,
        required: true,
    },
    adminRemarks: {
        type: String,
        default: '',
    },
    statusHistory: [
        {
            status: String,
            changedBy: String,
            changedAt: {
                type: Date,
                default: Date.now,
            },
            remark: String,
        },
    ],
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// Update the updatedAt field on save
ComplaintSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Complaint', ComplaintSchema);