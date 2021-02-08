var mongoose = require('mongoose');
var log = require('npmlog');
var LocalStrategy = require('passport-local').Strategy;
var config = require('../config');
var postgresqlHelper = require('../helpers/postgresql-helper');
var User = mongoose.model('User');


exports.init = function(passport) {
    passport.serializeUser(function(user, done) {
        done(null, user);
    });

    passport.deserializeUser(function(user, done) {
        done(null, user);
    });

    passport.use('local-signin', new LocalStrategy({
        usernameField: 'email',
        passwordField: 'password',
        passReqToCallback: true
    },
    function (req, email, password, done) {
        postgresqlHelper.externalLogin(req.body, function (err, user) {
            if (err && err === 'User not found') {
                return done(null, false, {message: 'Unknown user'});
            } else if (err && err === 'User password did not match') {
                return done(null, false, {message: 'Invalid password'});
            } else if (err && err === 'User does not have permission') {
                return done(null, false, {message: 'User does not have permission'});
            } else if (err) {
                return done(err);
            }

            User
                .findOne({email: user.email})
                .exec(function(err, loadedUser) {
                    if (err) {
                        return done(err);
                    }
                    if (loadedUser) {
                        return done(null, loadedUser);
                    } else {
                        var newUser = new User();
                        newUser.firstName = user.first_name;
                        newUser.lastName = user.last_name;
                        newUser.email = user.email;

                        newUser.save(function(err, savedUser) {
                            if (err) {
                                return done(err);
                            }
                            return done(null, savedUser);
                        });
                    }
                });
        });
    }));
};
