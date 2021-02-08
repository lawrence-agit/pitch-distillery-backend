var log = require('npmlog');
var passport = require('passport');

var LOG_PREFIX = 'AUTH';

exports.login = function (req, res, next) {
    if (!req.body.email && !req.body.password) {
        return res.status(400).jsonp('Bad params');
    }

    passport.authenticate('local-signin', function (err, user, info) {
        if (err) {
            return res.status(500).jsonp(err);
        }

        if (!user) {
            if (info && info.message === "Unknown user") {
                return res.status(403).jsonp({error: 'Login failed'});
            } else if (info && info.message === "Invalid password") {
                return res.status(403).jsonp({error: 'Wrong password'});
            } else if (info && info.message === 'User does not have permission') {
                return res.status(403).jsonp({error: 'Please contact clientsupport@shareablee.com.'});
            } else {
                return res.status(403).jsonp({error: 'Login failed'});
            }
        } else {
            req.logIn(user, function (err) {
                if (err) {
                    return res.status(500).jsonp(err);
                }

                console.log(LOG_PREFIX, 'User logged in with email: ' + user.email);
                return res.status(200).jsonp(user);
            });
        }
    })(req, res, next);
};

exports.logout = function (req, res) {
    req.logout();

    req.session.destroy(function (err) {
        if (err) {
            console.log(LOG_PREFIX, err);
            return res.status(500).jsonp(err);
        } else {
            console.log(LOG_PREFIX, 'Front End session destroyed');
            return res.status(200).send();
        }
    });
};
