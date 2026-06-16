const express = require('express');
const { body, validationResult } = require('express-validator');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Apply authorization middleware to all admin routes
router.use(protect);
router.use(authorize('admin'));

// @route   GET /api/admin/complaints
// @desc    Get all complaints (admin view)
// @access  Private (Admin only)
router.get('/complaints', async (req, res) => {
    try {
        const { status, category, search } = req.query;
        let query = {};

        if (status) {
            query.status = status;
        }
        if (category) {
            query.category = category;
        }
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { studentName: { $regex: search, $options: 'i' } },
            ];
        }

        const complaints = await Complaint.find(query).sort({ createdAt: -1 });

        // Get analytics data
        const totalComplaints = await Complaint.countDocuments();
        const pendingComplaints = await Complaint.countDocuments({ status: 'Pending' });
        const inProgressComplaints = await Complaint.countDocuments({ status: 'In Progress' });
        const resolvedComplaints = await Complaint.countDocuments({ status: 'Resolved' });

        // Category wise distribution
        const categoryDistribution = await Complaint.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]);

        res.status(200).json({
            success: true,
            count: complaints.length,
            data: complaints,
            analytics: {
                total: totalComplaints,
                pending: pendingComplaints,
                inProgress: inProgressComplaints,
                resolved: resolvedComplaints,
                categoryDistribution,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   PUT /api/admin/complaints/:id/status
// @desc    Update complaint status (admin only)
// @access  Private (Admin only)
router.put(
    '/complaints/:id/status',
    [
        body('status').isIn(['Pending', 'In Progress', 'Resolved']).withMessage('Invalid status'),
        body('remark').optional().isString(),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        try {
            const complaint = await Complaint.findById(req.params.id);

            if (!complaint) {
                return res.status(404).json({
                    success: false,
                    message: 'Complaint not found',
                });
            }

            const oldStatus = complaint.status;
            const newStatus = req.body.status;
            const remark = req.body.remark || `Status updated by admin`;

            // Add to status history
            complaint.statusHistory.push({
                status: newStatus,
                changedBy: req.user.name,
                remark: remark,
            });

            complaint.status = newStatus;
            complaint.adminRemarks = remark;
            complaint.updatedAt = Date.now();

            await complaint.save();

            console.log(`Notification: Complaint ${complaint.id} status changed from ${oldStatus} to ${newStatus}`);

            res.status(200).json({
                success: true,
                data: complaint,
                notification: `Student notified about status change to ${newStatus}`,
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }
);

// @route   GET /api/admin/analytics
// @desc    Get advanced analytics dashboard data
// @access  Private (Admin only)
router.get('/analytics', async (req, res) => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const dailyTrends = await Complaint.aggregate([
            {
                $match: {
                    createdAt: { $gte: thirtyDaysAgo },
                },
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        const resolvedComplaints = await Complaint.find({
            status: 'Resolved',
            statusHistory: { $elemMatch: { status: 'Resolved' } },
        });

        let avgResolutionHours = 0;
        if (resolvedComplaints.length > 0) {
            let totalHours = 0;
            resolvedComplaints.forEach((complaint) => {
                const resolvedEntry = complaint.statusHistory.find((h) => h.status === 'Resolved');
                if (resolvedEntry) {
                    const hours = (resolvedEntry.changedAt - complaint.createdAt) / (1000 * 60 * 60);
                    totalHours += hours;
                }
            });
            avgResolutionHours = totalHours / resolvedComplaints.length;
        }

        const totalStudents = await User.countDocuments({ role: 'student' });
        const activeStudents = await Complaint.distinct('student').countDocuments();
        const totalComplaints = await Complaint.countDocuments();
        const resolvedCount = await Complaint.countDocuments({ status: 'Resolved' });
        const resolvedRate = totalComplaints > 0 ? (resolvedCount / totalComplaints * 100).toFixed(1) : 0;

        res.status(200).json({
            success: true,
            data: {
                dailyTrends,
                avgResolutionHours: avgResolutionHours.toFixed(1),
                totalStudents,
                activeStudents,
                resolvedRate,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @route   GET /api/admin/users
// @desc    Get all registered students
// @access  Private (Admin only)
router.get('/users', async (req, res) => {
    try {
        const users = await User.find({ role: 'student' }).select('-password').sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: users.length,
            data: users,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;