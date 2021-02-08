var request = require('request');

exports.getImage = function(req, res, next) {
    if (typeof(req.query.callback) === "string") {
        request({url: req.query.url, encoding: 'binary'}, function(error, response, body) {
            if (error) {
                return next(error);
            }
            res.jsonp({content: new Buffer(body, 'binary').toString('base64'), type: response.headers['content-type']});
        });
    } else {
        req.pipe(request(req.query.url).on('error', next)).pipe(res);
    }
}