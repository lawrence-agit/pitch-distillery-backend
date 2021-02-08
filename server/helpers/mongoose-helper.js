var mongoose = require('mongoose');
var log = require('npmlog');
var fs = require('fs');
var _ = require('lodash');
var config = require('../config');

var LOG_PREFIX = 'MONGOOSE';
var MODELS_PATH = config.rootPath + '/server/models';
var connectionOpenCount = 0;

exports.init = function(callback) {
    mongoose.connection.on('open', function() {
        connectionOpenCount++;
        log.info(LOG_PREFIX, 'Connected to the database');
        if (connectionOpenCount === 1) {
            return callback(mongoose);
        }
    });

    mongoose.connection.on('error', function(err) {
        log.error(LOG_PREFIX, 'Error connecting to the database', err);
    });

    log.info(LOG_PREFIX, 'About to connect to the database at URL: ' + config.dbUrl);
    mongoose.connect(config.dbUrl);

    initModels();
};

function initModels() {
    log.info(LOG_PREFIX, 'About to initialise models at: %s', MODELS_PATH);

    try {
        var files = fs.readdirSync(MODELS_PATH);

        _.each(files, function(file) {
            if (/\.js$/.test(file)) {
                require(MODELS_PATH + '/' + file);
            }
        });

        log.info(LOG_PREFIX, 'Initialised models');
    } catch (e) {
        log.error(LOG_PREFIX, 'Error reading models directory', e);
    }
}
