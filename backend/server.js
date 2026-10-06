const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const multer = require('multer');
const app = express();
const PORT = process.env.PORT || 5000;
// 1. Configure where uploaded files are saved
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Make sure a folder named 'uploads' exists in your backend root
    },
    filename: (req, file, cb) => {
        // Create a unique filename using current timestamp + original extension
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.get('/', (req, res) => {
    res.json({ message: 'NexusHub API is running smoothly!' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
const memberRoutes = require('./routes/memberRoutes');
app.use('/api/members', memberRoutes);
const resourceRoutes = require('./routes/resourceRoutes');
app.use('/api/resources', resourceRoutes);
const requestRoutes = require('./routes/requestRoutes');
app.use('/api/requests', requestRoutes);
const activityRoutes = require('./routes/activityRoutes')
app.use('/api/activities', activityRoutes);
const dashboardRoutes = require('./routes/dashboardRoutes');
app.use('/api/dashboard', dashboardRoutes);
const staffDashboardRoutes = require('./routes/staff/dashboardRoutes');
app.use('/api/staff', staffDashboardRoutes);
const staffResourceRoutes = require('./routes/staff/resourceRoutes'); 
app.use('/api/staff/resources', staffResourceRoutes);
const staffRequestRoutes = require('./routes/staff/requestRoutes');
app.use('/api/staff/requests', staffRequestRoutes);
const changePasswordRouter = require('./routes/staff/changePasswordRoutes');
app.use('/api/staff', changePasswordRouter);
const notificationRoutes = require('./routes/notification/notification'); // Adjust path if needed
app.use('/api/notifications', notificationRoutes);