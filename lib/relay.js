'use strict';

var _inherits = require('babel-runtime/helpers/inherits')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _Promise = require('babel-runtime/core-js/promise')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

exports.__esModule = true;

var _superagent = require('superagent');

var _superagent2 = _interopRequireDefault(_superagent);

var _underscore = require('underscore');

var _underscore2 = _interopRequireDefault(_underscore);

var _eventemitter3 = require('eventemitter3');

var _eventemitter32 = _interopRequireDefault(_eventemitter3);

var Relay = (function (_EventEmitter) {
    function Relay() {
        var config = arguments[0] === undefined ? {} : arguments[0];

        _classCallCheck(this, Relay);

        _EventEmitter.call(this);
        this.config = _underscore2['default'].defaults(config, { apiUrl: '' });
        this._requestsInProgress = 0;

        // this can be used as extension point to add cache wrapper etc.,
        this._api = {};

        this._bindToEvents();
    }

    _inherits(Relay, _EventEmitter);

    /**
     * Example Schema:
     *
     * {
     *  'comments': {
     *        'create' : {
     *           path: '/comments',
     *           method: 'POST', //optional defaults to GET
     *           parse: function(res){}, optional callback:  function signature: function(res){return res;}
     *        }
     *   }
     * }
     *
     * above schema will be available as method
     * relay.api.comments_get()
     *
     * @param schema
     * @param config
     * @returns {Relay}
     */

    Relay.fromSchema = function fromSchema(schema, config) {
        var relay = new Relay(config);
        _underscore2['default'].each(schema, function (methods, resourceName) {
            _underscore2['default'].each(methods, function (methodConfig, methodName) {
                methodConfig.resourceName = resourceName;
                methodConfig.methodName = methodName;
                relay._addMethod(methodConfig);
            });
        });

        return relay;
    };

    /**
     * This should be used when you want to apply handler for all requests i.e by extending Request.prototype
     * @param handler
     */

    Relay.use = function use(handler) {
        handler.call(null, _superagent2['default']);
    };

    Relay.parser = function parser(request) {
        request.end = _underscore2['default'].wrap(request.end, function (wrappedEnd, cb) {
            cb = cb || _underscore2['default'].noop;
            return wrappedEnd.call(request, function (err, res) {
                if (!err && res.ok) {
                    if (request.options.parse && _underscore2['default'].isFunction(request.options.parse)) {
                        res.body = request.options.parse(res.body);
                    }
                }

                cb.apply(null, [err, res]);
            });
        });
    };

    Relay.promisify = function promisify(request) {
        request.end = _underscore2['default'].wrap(request.end, function (wrappedEnd, cb) {
            cb = cb || _underscore2['default'].noop;
            return new _Promise(function (resolve, reject) {
                wrappedEnd.call(request, function (err, res) {
                    if (err) {
                        reject(err, res);
                    } else {
                        // only promises will send response.body
                        // if you use callback you will get response instead of response.body
                        // so that we do not break any one extending Relay
                        resolve(res.body, res);
                    }

                    cb.apply(null, [err, res]);
                });
            });
        });
    };

    /**
     * if no params are given will return api object
     *
     * @param {string} [resource] can be resource or name of method i.e resource_method
     * @param {string} [method]
     */

    Relay.prototype.api = function api(resource, method) {
        if (resource && this._api[resource]) {
            if (method && this._api[resource][method]) {
                return this._api[resource][method];
            }
            return this._api[resource];
        }

        return this._api;
    };

    Relay.prototype.methods = function methods(resource, method) {
        return this.api(resource, method);
    };

    Relay.prototype._requestStarted = function _requestStarted() {
        this._requestsInProgress++;
        return this;
    };

    Relay.prototype._requestFinished = function _requestFinished() {
        if (this._requestsInProgress > 0) {
            this._requestsInProgress--;
            if (this._requestsInProgress == 0) {
                this.emit('requestsFinish');
            }
        }

        return this;
    };

    Relay.prototype._bindToEvents = function _bindToEvents() {

        var self = this;

        this.on('beforeRequest', function () {});

        this.on('request', function () {
            self._requestStarted();
        });

        this.on('abort', function () {
            self._requestFinished();
        });

        this.on('error', function () {
            self._requestFinished();
        });

        this.on('response', function () {
            self._requestFinished();
        });
    };

    /**
     *
     * @param {object} options
     * @param {string} [options.name=resourceName_methodName] This will identify resource uniquely ex: comments_get
     * @param {string} options.resourceName this is the resource ex: comments
     * @param {string} options.methodName this is the method name ex: create
     * @param {string} [options.method=GET] this is request method ex: 'GET','PUT', 'POST' etc.,
     * @param {string} options.path ex: '/comments' or '/comments/{id}, 'comments/create'
     * @param {function} [options.parse]
     */

    Relay.prototype._addMethod = function _addMethod(options) {
        options = options || {};

        if (!options.resourceName) {
            throw new Error('resource name is required');
        }

        options.resourceName = options.resourceName.toLowerCase();

        if (!options.methodName) {
            throw new Error('method name is required');
        }

        options.methodName = options.methodName.toLocaleLowerCase();

        if (!options.path) {
            throw new Error('path is required');
        }

        if (!options.name) {
            options.name = [options.resourceName, options.methodName].join('_');
        }

        options.name = options.name.toLocaleLowerCase();

        if (!options.method) {
            options.method = 'GET';
        }

        this._api[options.resourceName] = this._api[options.resourceName] || {};
        this._api[options.resourceName][options.methodName] = this._api[options.name] = this._generateRequestMethod(_underscore2['default'].clone(options));

        return this;
    };

    Relay.prototype._toURL = function _toURL(path, params) {

        if (!_underscore2['default'].isObject(params)) {
            params = {};
        }

        var matches = path.split('/:');
        _underscore2['default'].each(params, function (val, key) {
            path = path.replace('/:' + key, '/' + val);
        });

        _underscore2['default'].each(matches, function (val) {
            if (_underscore2['default'].indexOf(_underscore2['default'].keys(params), val) !== -1) {
                delete params[val];
            }
        });

        if (path.indexOf(':') != -1) {
            throw new Error('missing parameters for url: ' + path);
        }

        return this.config.apiUrl + path;
    };

    Relay.prototype._sanitizeQueryParams = function _sanitizeQueryParams(params) {
        _underscore2['default'].each(params, function (val, key) {
            if (_underscore2['default'].isEmpty(val) && !_underscore2['default'].isNumber(val)) {
                delete params[key];
            }
        });

        return params;
    };

    Relay.prototype._generateRequestMethod = function _generateRequestMethod(options) {

        var relay = this;

        /**
         * Example usage:
         *
         *  false as first or second parameter to method will return request for modification, it allows us to modify request.
         *  When ready to send request call end()  with or without callback.. end() will always return promise
         *
         *  var request = api.comments_get({count:1}, false);
         *  request.query({session_id: 1234});
         *  var promise = request.end();
         *  promise.then(function(res){});
         *
         *  if there is no need to modify request
         *
         *  var promise = api.comments_get({count:1});
         *  promise.then(function(res){});
         *
         *  or if there are no query params
         *
         *  var promise = api.comments_get();
         *  promise.then(function(res){});
         *
         *  or if you like node like callbacks
         *
         *  api.comments_get({count:1}, function(err, res){});
         *
         *  or
         *
         *  api.comments_get({count:1}, false).end(function(err, res){});
         *
         * data is optional, so you can pass callback or false as first parameter as well if needed.
         * @param {object|boolean|function} [data] data to sent to server
         * @param {boolean|function} [sendRequest=true]
         */
        return function () {
            var data = arguments[0] === undefined ? {} : arguments[0];
            var sendRequest = arguments[1] === undefined ? true : arguments[1];

            if (arguments.length == 1 && (_underscore2['default'].isBoolean(data) || _underscore2['default'].isFunction(data))) {
                sendRequest = data;
                data = {};
            }

            var callEnd = sendRequest !== false;
            var cb = _underscore2['default'].isFunction(sendRequest) ? sendRequest : null;

            var request = new _superagent2['default'].Request(options.method, relay._toURL(options.path, data || {}));

            // set request options so plugins can use
            request.options = options;

            if (data) {
                switch (options.method.toLowerCase()) {
                    case 'get':
                    case 'head':
                    case 'delete':
                        relay._sanitizeQueryParams(data);
                        request.query(data);
                        break;
                    case 'post':
                    case 'put':
                        request.send(data);

                }
            }

            request.on('abort', function () {
                relay.emit('abort', request);
            });

            request.on('request', function () {
                relay.emit('request', request);
            });

            relay.emit('beforeRequest', request);

            //add plugins
            request.use(Relay.parser);
            request.use(Relay.promisify);

            request.end = _underscore2['default'].wrap(request.end, function (wrappedEnd, cb) {
                cb = cb || _underscore2['default'].noop;
                return wrappedEnd.call(request, function (err, res) {
                    if (err) {
                        relay.emit('error', err, request, res);
                    } else {
                        relay.emit('response', request, res);
                    }

                    cb.apply(null, [err, res]);
                });
            });

            if (callEnd) {
                return request.end(cb);
            }

            // return request so user can modify and call end when ready
            return request;
        };
    };

    return Relay;
})(_eventemitter32['default']);

exports['default'] = Relay;
module.exports = exports['default'];