const APP = require('./app.js');
const port = 3000;

// Starts the server
APP.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});