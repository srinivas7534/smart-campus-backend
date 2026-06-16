const express = require('express');
const { body, validationResult } = require('express-validator');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/complaints
// @desc    Create a new complaint
// @access  Private (Student only)
router.post(
    '/',
    protect,
    [
        body('title').not().isEmpty().withMessage('Title is required'),
        body('category').not().isEmpty().withMessage('Category is required'),
        body('description').not().isEmpty().withMessage('Description is required'),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        try {
            const user = await User.findById(req.user.id);

            const complaint = await Complaint.create({
                title: req.body.title,
                category: req.body.category,
                description: req.body.description,
                imageUrl: req.body.imageUrl || '',
                student: req.user.id,
                studentName: user.name,
                studentEmail: user.email,
                statusHistory: [
                    {
                        status: 'Pending',
                        changedBy: user.name,
                        remark: 'Complaint submitted',
                    },
                ],
            });

            res.status(201).json({
                success: true,
                data: complaint,
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }
);

// @route   GET /api/complaints/my
// @desc    Get all complaints for logged in student
// @access  Private (Student)
router.get('/my', protect, async (req, res) => {
    try {
        const complaints = await Complaint.find({ student: req.user.id }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: complaints.length,
            data: complaints,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   GET /api/complaints/:id
// @desc    Get single complaint by ID
// @access  Private (Student who owns it or Admin)
router.get('/:id', protect, async (req, res) => {
    try {
        const complaint = await Complaint.findById(req.params.id);

        if (!complaint) {
            return res.status(404).json({
                success: false,
                message: 'Complaint not found',
            });
        }

        // Check if user is admin or the complaint owner
        if (req.user.role !== 'admin' && complaint.student.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this complaint',
            });
        }

        res.status(200).json({
            success: true,
            data: complaint,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   PUT /api/complaints/:id
// @desc    Update complaint (student can update only before admin action)
// @access  Private (Student)
router.put('/:id', protect, async (req, res) => {
    try {
        let complaint = await Complaint.findById(req.params.id);

        if (!complaint) {
            return res.status(404).json({
                success: false,
                message: 'Complaint not found',
            });
        }

        // Check ownership
        if (complaint.student.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this complaint',
            });
        }

        // Only allow update if complaint is still pending
        if (complaint.status !== 'Pending') {
            return res.status(400).json({
                success: false,
                message: 'Cannot update complaint that is already In Progress or Resolved',
            });
        }

        complaint = await Complaint.findByIdAndUpdate(
            req.params.id,
            {
                title: req.body.title || complaint.title,
                category: req.body.category || complaint.category,
                description: req.body.description || complaint.description,
                imageUrl: req.body.imageUrl || complaint.imageUrl,
            },
            {
                new: true,
                runValidators: true,
            }
        );

        res.status(200).json({
            success: true,
            data: complaint,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   DELETE /api/complaints/:id
// @desc    Delete complaint (student can delete only pending ones)
// @access  Private (Student)
router.delete('/:id', protect, async (req, res) => {
    try {
        const complaint = await Complaint.findById(req.params.id);

        if (!complaint) {
            return res.status(404).json({
                success: false,
                message: 'Complaint not found',
            });
        }

        // Check ownership
        if (complaint.student.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this complaint',
            });
        }

        // Only allow delete if complaint is still pending
        if (complaint.status !== 'Pending') {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete complaint that is already In Progress or Resolved',
            });
        }

        await complaint.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Complaint deleted successfully',
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;