var log = require('npmlog');
var async = require('async');
var _ = require('lodash');
var config = require('../config');
var mongoose = require('mongoose');
var User = mongoose.model('User');
var SharedList = mongoose.model('SharedList');

var LOG_PREFIX = 'USERS';

exports.loadSharedList = function(req, res, next, id) {
    SharedList.findOne({_id: id})
        .exec(function(err, sharedList) {
            if (err) {
                return res.status(500).jsonp(err);
            }

            if (!sharedList) {
                return res.status(404).jsonp('Shared List not found');
            }

            req.sharedList = sharedList;
            return next();
        });
};

exports.getUserLists = function(req, res) {
	var email = req.user ? req.user.email : req.query.email;

	SharedList
		.find({$or: [{emails: email}, {createdByEmail: email}]})
		.lean()
		.exec(function(err, sharedLists) {
			if (err) {
				return res.status(500).jsonp(err);
			}

      return res.status(200).jsonp(sharedLists);
		});
};

exports.createSharedList = function(req, res) {
	if (!req.body.listName && !req.body.entities && !req.body.userEmails) {
		return res.status(400).jsonp('Bad params');
	}

	var emails = req.body.userEmails;
	if (req.user) {
    emails.push(req.user.email);
	}
	emails = _.uniq(emails);

	var newSharedList = new SharedList();
	newSharedList.name = req.body.listName;
	newSharedList.emails = emails;
	newSharedList.entities = req.body.entities;
	newSharedList.createdByName = req.body.createdByName;
  newSharedList.createdByEmail = req.body.createdByEmail;

	newSharedList.save(function(err, savedSharedList) {
		if (err) {
			return res.status(500).jsonp(err);
		}

		return res.status(200).jsonp(savedSharedList);
	});
};

exports.updateSharedList = function(req, res) {
	if (!req.body.listName && !req.body.entities && !req.body.userEmails) {
		return res.status(400).jsonp('Bad params');
	}

	if (!req.sharedList) {
		return res.status(404).jsonp('Shared List not found');
	}

	req.sharedList.name = req.body.listName;
	req.sharedList.emails = req.body.userEmails;
	req.sharedList.entities = req.body.entities;
	req.sharedList.changed = new Date();

	req.sharedList.save(function(err, savedSharedList) {
		if (err) {
			return res.status(500).jsonp(err);
		}

		return res.status(200).jsonp(savedSharedList);
	});
};

exports.deleteSharedList = function(req, res) {
	console.log('About to delete list with ID: ' + req.params.listId);
  SharedList
    .deleteOne({_id: req.params.listId})
    .exec(function(err, sharedList) {
      if (err) {
        return res.status(500).jsonp(err);
      }
			return res.status(200).send();
    });
};

exports.testUser = function(req, res) {
	return res.status(200).json(req.user);
};
