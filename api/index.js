require('dotenv').config({ quiet: true });

const { getApp } = require('../app');

let app;

module.exports = async (req, res) => {
    if (!app) {
        app = await getApp();
    }

    return app(req, res);
};
