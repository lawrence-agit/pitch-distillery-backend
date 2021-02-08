var path = require('path');
var _ = require('lodash');
var package = require('../package.json');
var fs = require('fs');

var rootPath = path.normalize(__dirname + '/..');
var appName = package.name;
var port = process.env.PORT || 3000;
var env = process.env.NODE_ENV || 'development';

var config = {};

config.all = {
    appName: appName,
    env: env,
    port: port,
    rootPath: rootPath,
    shareableeApiUrl: 'http://api.shareablee.com/v1.4',
    shareableeApiToken: 'MTJlMGJhZjljMzo1ZWNlY2QwOWIzNDJhMjgyZGQxODIzZDU1ZDk0NGI0N2RiNjE3NDQyNWVkMjhlMWQ1MjE2NGRhNDQxZmU5MDcz'
};

config.development = {
    baseUrl: 'http://localhost:' + port,
    dbUrl: 'mongodb://shareablee:gk60d78dht03jdx8@ds051508-a1.mongolab.com:51508,ds051508-a0.mongolab.com:51508/shareablee?replicaSet=rs-ds051508',
    postgresqlDbUsername: 'gregoire',
    postgresqlDbHost: 'localhost',
    postgresqlDbName: 'gregoire',
    fakeAuthentication: true,
    sessionCookieDomain: 'localhost:3000',
    corsWhiteList: ['http://localhost:8080']
};

config.test = {
    baseUrl: 'http://pitch-builder-test.azurewebsites.net',
    dbUrl: 'mongodb://shareablee:gk60d78dht03jdx8@ds051508-a1.mongolab.com:51508,ds051508-a0.mongolab.com:51508/shareablee?replicaSet=rs-ds051508',
    postgresqlDbUsername: 'pitchbuilder',
    postgresqlDbPassword: '!nDKTD?jRS7jXx2S',
    postgresqlDbHost: 'postgres-replicas-public.int.shareablee.com',
    postgresqlDbName: 'template1',
    postgresqlDbPort: '6543',
    sessionCookieDomain: '.azurewebsites.net',
    corsWhiteList: ['http://pitch-builder-frontend-test.azurewebsites.net', 'http://localhost:8080']
};

config.production = {
    baseUrl: 'http://pitch-builder.azurewebsites.net',
    dbUrl: 'mongodb://shareablee:13EBK9qw6J@ds054999.mlab.com:54999/shareablee',
    postgresqlDbUsername: 'pitchbuilder',
    postgresqlDbPassword: '!nDKTD?jRS7jXx2S',
    postgresqlDbHost: 'postgres-replicas-public.int.shareablee.com',
    postgresqlDbName: 'template1',
    postgresqlDbPort: '6543',
    sessionCookieDomain: '.azurewebsites.net',
    corsWhiteList: ['http://pitch-builder-frontend.azurewebsites.net']
};

module.exports = _.merge({}, config.all, config[env]);
