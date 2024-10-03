const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.js');

        // User-related routes
router.get('/dashboard', userController.getDashboard);  // URL: /user/dashboard

module.exports = router;