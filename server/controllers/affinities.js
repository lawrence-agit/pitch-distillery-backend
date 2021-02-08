var log = require('npmlog');
var async = require('async');
var request = require('request');
var moment = require('moment');
var _ = require('lodash');
var config = require('../config');
var postgresqlHelper = require('../helpers/postgresql-helper');
var lruCache = require("lru-cache");

var LOG_PREFIX = 'AFFINITIES';

const PROPERTIES_MAX = 5000;
const MAX_PARALLEL_REQUESTS = 50;
const PROPERTIES_MAX_ERROR_MESSAGE = 'Categories have too many properties';

var cache = lruCache({max: 100 * 1000 * 1000, maxAge: 1000 * 60 * 60});

var metricConfig = [
    {
        fieldName: 'unique_engaged_audience',
        calculationType: 'average',
        numberOfDecimals: 0
    },
    {
        fieldName: 'total_actions',
        calculationType: 'average',
        numberOfDecimals: 0
    },
    {
        fieldName: 'video_likes',
        calculationType: 'average',
        numberOfDecimals: 0
    },
    {
        fieldName: 'post_count',
        calculationType: 'average',
        numberOfDecimals: 1
    },
    {
        fieldName: 'latest_fans',
        calculationType: 'latest',
        numberOfDecimals: 0
    },
    {
        fieldName: 'actions_percent_male',
        calculationType: 'average',
        numberOfDecimals: 1
    },
    {
        fieldName: 'engagers_percent_male',
        calculationType: 'average',
        numberOfDecimals: 1
    },
    {
        fieldName: 'native_video_views',
        calculationType: 'average',
        getter: function(metrics, entityType) {
            if (!metrics) {
                return 0;
            }
            if (entityType === 'property') {
                return typeof metrics.native_video_views === 'number' ? metrics.native_video_views : 0;
            } else {
                return typeof metrics.native_video_views_average === 'number' ? metrics.native_video_views_average : 0;
            }
        },
        numberOfDecimals: 0
    },
    {
        fieldName: 'affinity',
        calculationType: 'average',
        numberOfDecimals: 1
    }
]

var countries = ['AU', 'BR', 'CA', 'CL', 'CO', 'DE', 'ES', 'FR', 'GB', 'ID', 'IN', 'IT', 'JP', 'MX', 'NL', 'PH', 'PL', 'TR', 'US'];

_.each(countries, function(country_code) {
    metricConfig.push({
        fieldName: 'fans_by_country_percentage_' + country_code,
        calculationType: 'average',
        numberOfDecimals: 1,
        getter: function(metrics, entityType) {
            if (!metrics) {
                return 0;
            }
            var countryValue = _.find(metrics.fans_by_country, function(item) {
                return item.code === country_code;
            });
            if (!countryValue) {
                return 0;
            }
            return countryValue.percent;
        }
    });
});

exports.getAvailableShareableeMonths = function(req, res) {
    makeShareableeRequest({path: '/facebook/affinity/months'}, function(err, result) {
        if (err) {
            return res.status(500).jsonp(err);
        }

        var months = [];
        _.each(result, function(date) {
            months.push(date.substr(0, date.lastIndexOf("-")));
        });

        return res.status(200).jsonp(months);
    });
};

exports.getShareableePropertiesAndCategories = function(req, res) {
    log.info(LOG_PREFIX, 'getShareableePropertiesAndCategories');
    if (!req.query && !req.query.searchText) {
        return res.status(400).jsonp('Missing params');
    }

    var params = {
        queryText: req.query.searchText,
        queryLimit: req.query.queryLimit ? req.query.queryLimit : 100,
        userEmail: req.user.email
    };

    var cacheKey = JSON.stringify(params);
    var cachedValue = cache.get(cacheKey);
    if (cachedValue) {
        var result = {
            items: cachedValue,
            cacheKey: cacheKey,
            fromCache: true
        };
        return res.status(200).jsonp(result);
    }

    postgresqlHelper.getUserPropertiesAndCategories(params, function(err, result) {
        if (err) {
            log.error(LOG_PREFIX, err);
            return res.status(500).jsonp(err);
        }
        cache.set(cacheKey, result);
        var response = {
            items: result,
            cacheKey: cacheKey,
            fromCache: false
        };
        return res.status(200).jsonp(response)
    });
}

exports.getShareableeProperties = function(req, res) {
    log.info(LOG_PREFIX, 'getShareableeProperties');
    if (!req.query && !req.query.searchText) {
        return res.status(400).jsonp('Missing params');
    }

    var params = {
        queryText: req.query.searchText,
        queryLimit: req.query.queryLimit ? req.query.queryLimit : 100,
        userEmail: req.user.email
    }

    var cacheKey = JSON.stringify(params);
    var cachedValue = cache.get(cacheKey);
    if (cachedValue) {
        var result = {
            items: cachedValue,
            cacheKey: cacheKey,
            fromCache: true
        };
        return res.status(200).jsonp(result);
    }

    postgresqlHelper.getUserProperties(params, function(err, result) {
        if (err) {
            log.error(LOG_PREFIX, err);
            return res.status(500).jsonp(err);
        }
        cache.set(cacheKey, result);
        var response = {
            items: result,
            cacheKey: cacheKey,
            fromCache: false
        };
        return res.status(200).jsonp(response)
    });
}

exports.comparisonAffinity = function(req, res) {
    log.info(LOG_PREFIX, 'comparisonAffinity');

    if (!req.body.entityId) {
        return res.status(400).jsonp('Bad params');
    }

    if (!req.body.comparisonIds) {
        return res.status(400).send('Missing Comparison IDs');
    }

    var params = req.body;

    params.startDate = req.body.startDate;
    params.endDate = req.body.endDate;

    var tasks = [
        async.apply(getShareableeDates, params),
        getComparison
    ];

    async.waterfall(tasks, function(err, results) {
        if (err) {
            if (err === PROPERTIES_MAX_ERROR_MESSAGE) {
                return res.status(200).jsonp({
                    errorMessage: PROPERTIES_MAX_ERROR_MESSAGE
                });
            }
            return res.status(500).jsonp(err);
        }

        return res.status(200).jsonp(results);
    });
}

exports.getRawComparison = function(req, res) {
    log.info(LOG_PREFIX, 'getRawComparison');

    var params = {
        startDate: req.params.startDate,
        endDate: req.params.endDate,
        entityId: req.params.targetEntityId
    };

    if (req.params.comparisonEntityType === 'property') {
        params.comparisonIds = [
            {
                property_id: req.params.comparisonEntityId
            }
        ];
    } else {
        params.comparisonIds = [
            {
                category_id: req.params.comparisonEntityId
            }
        ];
    }

    var tasks = [
        async.apply(getShareableeDates, params),
        getComparison
    ];

    async.waterfall(tasks, function(err, results) {
        if (err) {
            return res.status(500).jsonp(err);
        }

        return res.status(200).jsonp(results);
    });
}

exports.getRawMetrics = function(req, res) {
    getMetrics(req.params.entityType, req.params.entityId, req.params.startDate, req.params.endDate, function(err, metrics) {
        if (err) {
            res.status(500).send();
        }
        res.status(200).jsonp(metrics);
    })
};

function getShareableeMetrics(entityType, month, entity, callback) {
    delete entity.unique_engaged_users;

    getMetrics(entityType, entity.object_id, month.start, month.end, function(err, result) {
        if (err) {
            return callback(err);
        }
        mapMetrics(entity, entityType, result.metrics, month.start);
        entity.facebook_id = result.object_id;

        return callback();
    });
}

exports.getMappedMetrics = function(req, res) {
    getMetrics(req.params.entityType, req.params.entityId, req.params.startDate, req.params.endDate, function(err, result) {
        if (err) {
            res.status(500).send();
        }
        var entity = {
            name: result.name,
            entity_id: result.entity_id,
            object_id: result.object_id
        };
        mapMetrics(entity, req.params.entityType, result.metrics, req.params.startDate);
        res.status(200).jsonp(entity);
    })
};

function getMetrics(entityType, entityId, startDate, endDate, callback) {
    var params = {};

    if (entityType === 'property') {
        params.path = '/user/' + entityId + '/facebook/metrics/';
    } else {
        params.path = '/category/' + entityId + '/facebook/metrics/';
    }

    params.path += '?start_date=' + startDate;
    params.path += '&end_date=' + endDate;

    makeShareableeRequest(params, callback);
};

function getComparison(params, callback) {
    var properties = [];
    var categories = [];

    params.comparisonIds = _.uniqBy(params.comparisonIds, 'name');

    _.each(params.comparisonIds, function(entity) {
        if (entity.property_id) {
            properties.push(entity.property_id);
        } else {
            categories.push(entity.category_id);
        }
    });

    params.properties = properties.length > 0 ? properties : [];
    params.categories = categories.length > 0 ? categories : [];

    if (params.properties && params.properties.length) {
        params.properties = _.reject(properties, function(id) {
            return id.toString() === params.entityId.toString();
        });
    }

    if (params.categories && params.categories.length) {
        params.categories = _.reject(categories, function(id) {
            return id.toString() === params.entityId.toString();
        });
    }

    var tasks = [
        async.apply(getPropertiesComparison, params),
        async.apply(getCategoriesComparison, params)
    ];

    async.parallel(tasks, function(err, results) {
        if (err) {
            return callback(err);
        }

        results = results[0].concat(results[1]);

        var finalResult = [];

        _.each(results, function(item) {
            if (item && item.object_id) {
                var foundItem = _.find(finalResult, {object_id: item.object_id});

                if (!foundItem) {
                    finalResult.push(item);
                } else {
                    mergeMetrics(foundItem, item);
                }
            }
        });

        _.each(finalResult, finaliseMetrics);

        var resultToSend = {
            result: finalResult
        };

        finaliseResult(resultToSend);

        return callback(null, resultToSend);
    });
}

function finaliseResult(resultToSend) {
    total = {};
    count = {};
    max = {};

    _.each(metricConfig, function(metric) {
        total[metric.fieldName] = 0;
        count[metric.fieldName] = 0;
        max[metric.fieldName] = 0;
        _.each(resultToSend.result, function(item) {
            if (item[metric.fieldName]) {
                total[metric.fieldName] += item[metric.fieldName];
                count[metric.fieldName]++;
                if (max[metric.fieldName] < item[metric.fieldName]) {
                    max[metric.fieldName] = item[metric.fieldName];
                }
            }
        });

        var multiplier = Math.pow(10, metric.numberOfDecimals);
        resultToSend[metric.fieldName + '_result_average'] = count[metric.fieldName] > 0 ? Math.round(total[metric.fieldName] * multiplier / count[metric.fieldName])  / multiplier : 0;
        resultToSend[metric.fieldName + '_result_max'] = max[metric.fieldName];
    });

    _.each(resultToSend.result, function(item) {
        if (typeof item.affinity === 'number') {
            item.normalized_affinity = Math.round((item.affinity / resultToSend.affinity_result_average * 100) * 10) / 10;
        } else {
            item.normalized_affinity = 'N/A';
        }
    });
}

function getPropertiesComparison(params, callback) {
    if (!params.properties || params.properties.length === 0) {
        return callback(null, []);
    }

    var _params = {
        entityId: params.entityId,
        comparisonIds: params.properties,
        comparisonType: 'property',
        months: params.months
    };

    getAffinityResults(_params, function(err, results) {
        if (err) {
            if (err === 'Shareablee API Error: Affinity score unavailable') {
                return callback('Affinity score unavailable');
            } else {
                return callback(err);
            }
        }
        return callback(null, results);
    });
}

function getCategoriesComparison(params, callback) {
    if (!params.categories || params.categories.length === 0) {
        return callback(null, []);
    }

    async.map(params.categories, getCategoryMembers, function(err, result) {
        if (err) {
            return callback(err);
        }

        var entityIds = _.map(result, function(item) {
            return _.map(item.members, 'entity_id');
        });

        entityIds = _.flatten(entityIds);

        if (entityIds.length > PROPERTIES_MAX) {
            return callback(PROPERTIES_MAX_ERROR_MESSAGE);
        }

        var propertyComparisonParams = {
            entityId: params.entityId,
            properties: entityIds,
            months: params.months
        }

        getPropertiesComparison(propertyComparisonParams, callback);
    });
}

function getCategoryMembers(category, callback) {
    makeShareableeRequest({path: '/category/' + category + '/facebook'}, callback);
}

function getAffinityResults(params, callback) {
    var results = [];

    async.each(params.months, function(month, _callback) {
        console.log('Going to look at month: ' + month.label);
        log.info(LOG_PREFIX, 'CURRENT MONTH ', month.label);

        var tasks = [
            async.apply(getAffinity, params, month),
            getMetrics
        ];

        async.waterfall(tasks, function(err, waterfallResults) {
            if (err) {
                return _callback(err);
            }
            results = results.concat(waterfallResults);
            return _callback(null);
        });

        function getAffinity(params, month, cb) {
            var requestParams = buildRequestParams({
                type: 'affinity',
                network: 'facebook',
                entityId: params.entityId,
                comparisonIds: params.comparisonIds,
                comparisonType: params.comparisonType,
                startDate: month.start,
                endDate: month.end
            });

            makeShareableeRequest(requestParams, function(err, affinityResult) {
                if (err) {
                    return cb(err);
                }
                return cb(null, params, month, affinityResult.results);
            });
        }

        function getMetrics(params, month, affinityItems, cb) {
            async.eachLimit(affinityItems, MAX_PARALLEL_REQUESTS, async.apply(getShareableeMetrics, params.comparisonType, month), function(err) {
                if (err) {
                    return cb(err);
                }

                return cb(null, affinityItems);
            });
        }
    }, function(err) {
        if (err) {
            return callback(err);
        }

        return callback(null, results)
    });
}

function buildRequestParams(params) {
    var requestParams = {
        path: '/user/' + params.entityId + '/' + params.network + '/' + params.type + '/comparison/' + params.comparisonType + '/'
    };

    requestParams.path += '?start_date=' + params.startDate;
    requestParams.path += '&end_date=' + params.endDate;

    _.each(params.comparisonIds, function(objectId) {
        requestParams.path += '&object_id=' + objectId;
    });

    return requestParams;
}

function mapMetrics(entity, entityType, metrics, timestamp) {
    _.each(metricConfig, function(metric) {
        if (metric.calculationType === 'latest') {
            entity[metric.fieldName + '_latest'] = timestamp;
        } else if (metric.calculationType === 'average') {
            entity[metric.fieldName + '_count'] = 1;
        }

        if (entity[metric.fieldName]) {
            return;
        }

        if (metric.getter) {
            entity[metric.fieldName] = metric.getter(metrics, entityType);
        } else {
            if (metrics) {
                entity[metric.fieldName] = typeof metrics[metric.fieldName] === 'number' ? metrics[metric.fieldName] : 0;
            }
        }
    });
}

function mergeMetrics(entityTarget, entity) {
    _.each(metricConfig, function(metric) {
        if (metric.calculationType === 'average') {
            entityTarget[metric.fieldName] += entity[metric.fieldName];
            entityTarget[metric.fieldName + '_count'] += entity[metric.fieldName + '_count'];
        } else if (metric.calculationType === 'latest') {
            if (entityTarget[metric.fieldName + '_latest'] > entity[metric.fieldName + '_latest']) {
                entityTarget[metric.fieldName] = entity[metric.fieldName];
            }
        }
    });
}

function finaliseMetrics(entity) {
    _.each(metricConfig, function(metric) {
        if (metric.calculationType === 'average') {
            var multiplier = Math.pow(10, metric.numberOfDecimals);
            entity[metric.fieldName] = Math.round((entity[metric.fieldName] / entity[metric.fieldName + '_count']) * multiplier) / multiplier;
        }
    });
}

function makeShareableeRequest(params, callback) {
    var cachedValue = cache.get(params.path);
    if (cachedValue) {
        console.log('serving from cache for URL: ' + params.path);
        return callback(null, _.cloneDeep(cachedValue));
    }

    var options = {
        method: 'GET',
        url: config.shareableeApiUrl + params.path,
        headers: {
            Authorization: 'Basic ' + config.shareableeApiToken
        },
        qs: params.qs,
        json: true
    };

    console.log('About to make shareablee request', options.url);

    request(options, function(err, response, body) {
        if (err) {
            log.error(LOG_PREFIX, err);
            return callback(err);
        }

        if (!body) {
            log.error(LOG_PREFIX, 'No response from Shareablee API');
            return callback('No response from Shareablee API');
        }

        if (body.error) {
            log.error(LOG_PREFIX, 'Shareablee API Error: ' + body.error);
            return callback('Shareablee API Error: ' + body.error);
        }

        cache.set(params.path, body);
        return callback(null, _.cloneDeep(body));
    });
}

function getShareableeDates(params, callback) {
    makeShareableeRequest({path: '/facebook/affinity/months'}, function(err, result) {
        if (err) {
            return callback(err);
        }

        params.months = getRequestedMonths(params, result);
        return callback(null, params);
    });
}

function getRequestedMonths(params, shareableeMonths) {
    var months = [];

    if (!params.startDate && !params.endDate) {
        var month = {
            label: moment(shareableeMonths[0]).format('MMMM YYYY'),
            start: moment(shareableeMonths[0]).startOf('month').format('YYYY-MM-DD'),
            end: moment(shareableeMonths[0]).endOf('month').format('YYYY-MM-DD')
        };
        months.push(month);
    } else {
        var dateParams = {
            start: moment(params.startDate),
            end: moment(params.endDate)
        };
        months = getDateRange(dateParams);
    }

    return months;
}

function getDateRange(params) {
    var months = [];
    var dateStart = params.start;
    var dateEnd = params.end;

    while (dateEnd > dateStart) {
        months.push(dateStart.format('YYYY-MM-DD'));
        dateStart.add(1, 'month');
    }

    var result = [];

    _.each(months, function(month) {
        result.push({
            label: moment(month).format('MMMM YYYY'),
            start: moment(month).startOf('month').format('YYYY-MM-DD'),
            end: moment(month).endOf('month').format('YYYY-MM-DD')
        });
    });

    return result;
}

exports.getCategoryMembers = function(req, res) {
    makeShareableeRequest({path: '/category/' + req.params.categoryId + '/facebook'}, function(err, result) {
        if (err) {
            return res.status(500).jsonp(err);
        }

        return res.status(200).jsonp(result);
    });
};