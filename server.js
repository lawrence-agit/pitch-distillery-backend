var express = require('express');
var helmet = require('helmet');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var compression = require('compression');
var session = require('express-session');
var passport = require('passport');
var mongoStore = require('connect-mongo')(session);
var log = require('npmlog');
var cors = require('cors');
var _ = require('lodash');
var routes = require('./server/routes');
var config = require('./server/config');
var mongooseHelper = require('./server/helpers/mongoose-helper');

var LOG_PREFIX = 'SERVER';

mongooseHelper.init(function(mongooseInstance) {
    var passportHelper = require('./server/helpers/passport-helper');
	passportHelper.init(passport);

	var app = express();

	app.set('trust-proxy', true);
    app.options('*',cors(corsOptionsDelegate));
    app.enable("jsonp callback");

    app.use(cors(corsOptionsDelegate));
	app.use(helmet());
	app.use(bodyParser.urlencoded({extended: true}));
	app.use(bodyParser.json());
	app.use(cookieParser());
	app.use(compression());
	app.use(express.static(config.rootPath + '/client'));
    app.use(session({
        resave:false,
        rolling: true,
        saveUninitialized:true,
        secret: 'shareableesecret',
        store: new mongoStore({
            db: mongooseInstance.connection.db,
            collection: 'sessions'
        })
    }));

	app.use(passport.initialize());
	app.use(passport.session());

	routes.init(app);
	app.use(express.static(config.rootPath + '/client'));

	app.listen(config.port, function() {
	    log.info(LOG_PREFIX, 'Server has started on port %s using %s environment', config.port, config.env);
	});
});

function corsOptionsDelegate(req,callback) {
    var corsOptions = {
        origin: true,
        methods: ['POST', 'GET', 'PUT', 'OPTIONS'],
        credentials: true
    };

    if (_.includes(config.corsWhiteList,req.headers.origin)) {
        corsOptions.origin = true;
    }

    callback(null,corsOptions);
}
