var pg = require('pg');
var config = require('../config');
var async = require('async');
var hashers = require('node-django-hashers');
var log = require('npmlog');
var _ = require('lodash');

var LOG_PREFIX = 'POSTGRESQL';

function initClient(callback) {
    var configPostgre = {
        user: config.postgresqlDbUsername,
        database: config.postgresqlDbName,
        password: config.postgresqlDbPassword,
        host: config.postgresqlDbHost,
        port: config.postgresqlDbPort
    };

    var client = new pg.Client(configPostgre);
    console.log(LOG_PREFIX, 'client created');
    client.connect(function (err, client) {
        console.log(LOG_PREFIX, 'connected client');
        if (err) {
            return callback(err);
        }

        return callback(null, client);
    });
};

function disconnectClient(client, callback) {
    if (!client) {
        return callback('No client to disconnect')
    }

    client.end(function (err) {
        return callback(err);
    });
};

exports.externalLogin = function (user, callback) {
    console.log(LOG_PREFIX, 'External login for user: ', user);
    var tasks = [
        getPostgresqlClient,
        getUser,
        checkCredentials,
        checkUserPermission
    ];

    async.waterfall(tasks, function (err, user) {
        if (err) {
            return callback(err);
        }

        return callback(null, user);
    });

    function getPostgresqlClient(cb) {
        initClient(function (err, client) {
            if (err) {
                return cb(err);
            }

            console.log(LOG_PREFIX, 'Got POSTGRESQL client');
            return cb(null, client);
        });
    }

    function getUser(client, cb) {
        client.query("SELECT * FROM auth_user WHERE email=($1)", [user.email], function (err, result) {
            if (err) {
                return cb(err);
            }

            if (result && result.rows && result.rows.length === 1) {
                return cb(null, client, result.rows[0]);
            }

            return cb('User not found');
        });
    }


    function checkUserPermission(client, dbUser, cb) {
        console.log(LOG_PREFIX, 'Trying to check permission: ', dbUser);

        // check if user has permission
        client.query("SELECT has_pitch_distillery_access($1)", [dbUser.id], function (err, result) {
            if (err) {
                console.log(LOG_PREFIX, 'Error while checking permission: ', err);
                return cb(err);
            }

            disconnectClient(client, function (err) {
                if (err) {
                    return cb(err);
                }

                // if user has permission 
                if (result && result.rows && result.rows.length === 1 && result.rows[0].has_pitch_distillery_access === true) {
                    return cb(null, dbUser);
                } else {
                    return cb('User does not have permission');
                }
            });
        });
    }

    function checkCredentials(client, dbUser, cb) {
        var isPasswordValid = verifyPassword(user.password, dbUser.password);

        if (isPasswordValid) {
            return cb(null, client, dbUser);
        } else {
            return cb('User password did not match');
        }
    }

    function verifyPassword(password, hashedPassword) {
        var h = new hashers.PBKDF2PasswordHasher();
        var hash1 = h.encode(password, h.salt());

        return h.verify(password, hashedPassword);
    }
};

exports.getUserProperties = function (params, callback) {
    var tasks = [
        getPostgresqlClient,
        getUserProperties
    ];

    async.waterfall(tasks, function (err, results) {
        if (err) {
            console.log(LOG_PREFIX, err)
            return callback(err);
        }

        return callback(null, results);
    });

    function getPostgresqlClient(cb) {
        initClient(function (err, client) {
            if (err) {
                return cb(err);
            }
            return cb(null, client);
        });
    }

    function getUserProperties(client, cb) {
        client.query("SELECT * FROM get_pitch_builder_properties($1::text, $2::text, $3::int)", [params.userEmail, params.queryText, params.queryLimit], function (err, result) {
            if (err) {
                console.log(LOG_PREFIX, err);
                return cb(err);
            }

            if (result && result.rows) {
                getPropertiesImages(result.rows)
                return cb(null, result.rows);
            }

            return cb(null, []);
        });
    }
}


exports.getUserPropertiesAndCategories = function (params, callback) {
    var tasks = [
        getPostgresqlClient,
        getUserProperties,
        getUserCategories
    ];

    async.waterfall(tasks, function (err, results) {
        if (err) {
            console.log(LOG_PREFIX, err)
            return callback(err);
        }

        return callback(null, results);
    });

    function getPostgresqlClient(cb) {
        initClient(function (err, client) {
            if (err) {
                return cb(err);
            }
            return cb(null, client);
        });
    }

    function getUserProperties(client, cb) {
        client.query("SELECT * FROM get_pitch_builder_properties($1::text, $2::text, $3::int)", [params.userEmail, params.queryText, params.queryLimit], function (err, result) {
            if (err) {
                console.log(LOG_PREFIX, err);
                return cb(err);
            }

            if (result && result.rows) {
                getPropertiesImages(result.rows)
                return cb(null, client, result.rows);
            }

            return cb(null, client, []);
        });
    }

    function getUserCategories(client, properties, cb) {
        client.query("SELECT * FROM get_pitch_builder_categories($1::text, $2::text, $3::int)", [params.userEmail, params.queryText, params.queryLimit], function (err, result) {
            if (err) {
                console.log(LOG_PREFIX, err);
                return cb(err);
            }
            console.log(LOG_PREFIX, 'Executed category query');
            disconnectClient(client, function (err) {
                if (err) {
                    return cb(err);
                }

                if (result && result.rows) {
                    return cb(null, properties.concat(result.rows));
                }

                return cb(null, properties.concat([]));
            });
        });
    }
};

function getPropertiesImages(properties) {
    _.each(properties, function (property) {
        property.image_url = 'graph.facebook.com/' + property.facebook_page_id + '/picture?type=small';
    });
};
