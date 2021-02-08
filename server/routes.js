var config= require('./config');
var isAuthenticated = require('./middleware').isAuthenticated;
var postgresqlHelper = require('./helpers/postgresql-helper')

exports.init = function(app) {
    app.get('/', function(req, res) {
        return res.sendFile(config.rootPath + '/public/index.html');
    });

    var authenticationController = require('./controllers/authentications');
    app.post('/api/login', authenticationController.login);
    app.get('/api/logout', authenticationController.logout);

    var affinityController = require('./controllers/affinities');
    app.get('/api/entity-typeahead/properties-and-categories', isAuthenticated, affinityController.getShareableePropertiesAndCategories);
    app.get('/api/entity-typeahead/properties', isAuthenticated, affinityController.getShareableeProperties);
    app.post('/api/affinity/comparison', isAuthenticated, affinityController.comparisonAffinity);
    app.get('/api/affinity/get-available-months', isAuthenticated, affinityController.getAvailableShareableeMonths);
    app.get('/api/affinity/get-category-members/:categoryId', isAuthenticated, affinityController.getCategoryMembers);
    app.get('/api/affinity/get-raw-metrics/:entityType/:entityId/:startDate/:endDate', isAuthenticated, affinityController.getRawMetrics);
    app.get('/api/affinity/get-mapped-metrics/:entityType/:entityId/:startDate/:endDate', isAuthenticated, affinityController.getMappedMetrics);
    app.get('/api/affinity/get-comparison/:targetEntityType/:targetEntityId/:comparisonEntityType/:comparisonEntityId/:startDate/:endDate', isAuthenticated, affinityController.getRawComparison);

    var userController = require('./controllers/users');
    app.get('/api/user/get-lists', isAuthenticated, userController.getUserLists);
    app.post('/api/user/lists', isAuthenticated, userController.createSharedList);
    app.put('/api/user/lists/:listId', isAuthenticated, userController.updateSharedList);
    app.post('/api/user/lists/:listId/delete', isAuthenticated, userController.deleteSharedList);
    app.get('/api/user/test', isAuthenticated, userController.testUser);

    var imageController = require('./controllers/images');
    app.get('/api/image-proxy', imageController.getImage);

    app.param('listId', userController.loadSharedList);
};
