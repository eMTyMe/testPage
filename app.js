const express = require('express');

const APP = express();

APP.set('view engine', 'ejs');
APP.set('views', "./views");
APP.use(express.json());

const userRoutes = require('./routes/user.js');
APP.use('/user', userRoutes);  // puts user related routes under /user

module.exports = APP;