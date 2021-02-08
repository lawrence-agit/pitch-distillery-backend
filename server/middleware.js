var log = require('npmlog');
var config = require('./config')

var LOG_PREFIX = 'MIDDLEWARE';

// route middleware to make sure a user is logged in
exports.isAuthenticated = function(req, res, next) {
    if (config.fakeAuthentication) {
        log.info(LOG_PREFIX, 'Fake authentication');
        return next();
    }

    if (req.isAuthenticated()) {
        log.info(LOG_PREFIX, 'User is authenticated');
        return next();
    }

    log.warn(LOG_PREFIX, 'User is NOT authenticated');
    return res.status(401).send('User is NOT authenticated');
};
