const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Static uploads directory
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ message: 'NexusHub API is running smoothly!' });
});

// Route imports
const authRoutes = require('./routes/authRoutes');
const memberRoutes = require('./routes/memberRoutes');
const resourceRoutes = require('./routes/resourceRoutes');
const requestRoutes = require('./routes/requestRoutes');
const activityRoutes = require('./routes/activityRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const notificationRoutes = require('./routes/notification/notification');
const staffResourceRoutes = require('./routes/staff/resourceRoutes');
const staffDashboardRoutes = require('./routes/staff/dashboardRoutes');
const staffRequestRoutes = require('./routes/staff/requestRoutes');
const changePasswordRouter = require('./routes/staff/changePasswordRoutes');

// Route registrations
app.use('/api/auth', authRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);

// Staff specific routes (more specific routes mounted first)
app.use('/api/staff/resources', staffResourceRoutes);
app.use('/api/staff/requests', staffRequestRoutes);
app.use('/api/work-requests', staffRequestRoutes); // Alias for work-requests compatibility
app.use('/api/staff', changePasswordRouter);
app.use('/api/staff', staffDashboardRoutes);

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});