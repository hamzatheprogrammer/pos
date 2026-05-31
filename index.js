require('dotenv').config({ quiet: true });

const { getApp } = require('./app');

const port = process.env.PORT || 3000;

getApp()
    .then((app) => {
        app.listen(port, () => {
            console.log(`Server is running on port  http://localhost:${port}`);
        });
    })
    .catch((err) => {
        console.error('Failed to start server:', err.message);
        process.exit(1);
    });
