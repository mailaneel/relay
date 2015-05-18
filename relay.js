'use strict';

var _inherits = require('babel-runtime/helpers/inherits')['default'];

var _get = require('babel-runtime/helpers/get')['default'];

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _Object$defineProperty = require('babel-runtime/core-js/object/define-property')['default'];

var _Promise = require('babel-runtime/core-js/promise')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

_Object$defineProperty(exports, '__esModule', {
    value: true
});

var _superagent = require('superagent');

var _superagent2 = _interopRequireDefault(_superagent);

var _underscore = require('underscore');

var _underscore2 = _interopRequireDefault(_underscore);

var _eventemitter3 = require('eventemitter3');

var _eventemitter32 = _interopRequireDefault(_eventemitter3);

var ParseAwareRequest = (function (_request$Request) {
    function ParseAwareRequest() {
        _classCallCheck(this, ParseAwareRequest);

        if (_request$Request != null) {
            _request$Request.apply(this, arguments);
        }
    }

    _inherits(ParseAwareRequest, _request$Request);

    _createClass(ParseAwareRequest, [{
        key: 'addParsers',
        value: function addParsers(parsers) {
            this._parseAwareParsers = this._parseAwareParsers || [];

            var self = this;
            if (parsers) {
                if (_underscore2['default'].isFunction(parsers)) {
                    self._parseAwareParsers.push(parsers);
                }

                if (_underscore2['default'].isArray(parsers)) {
                    _underscore2['default'].each(parsers, function (parser) {
                        self._parseAwareParsers.push(parser);
                    });
                }
            }

            return this;
        }
    }, {
        key: 'getParsers',
        value: function getParsers() {
            return this._parseAwareParsers || [];
        }
    }, {
        key: 'end',

        /**
         *
         * @param cb
         * @returns {*}
         */
        value: function end(cb) {
            cb = cb || _underscore2['default'].noop;
            var parsers = this.getParsers();
            return _get(Object.getPrototypeOf(ParseAwareRequest.prototype), 'end', this).call(this, function (err, res) {
                if (!err && res.ok) {
                    // call parse handlers
                    _underscore2['default'].each(parsers, function (parser) {
                        res.body = parser(res.body);
                    });
                }

                cb.apply(null, [err, res]);
            });
        }
    }]);

    return ParseAwareRequest;
})(_superagent2['default'].Request);

// promise should be the last one
// because promise will either resolve or reject by the time parsers are called

var PromiseAwareRequest = (function (_ParseAwareRequest) {
    function PromiseAwareRequest() {
        _classCallCheck(this, PromiseAwareRequest);

        if (_ParseAwareRequest != null) {
            _ParseAwareRequest.apply(this, arguments);
        }
    }

    _inherits(PromiseAwareRequest, _ParseAwareRequest);

    _createClass(PromiseAwareRequest, [{
        key: 'end',
        value: function end(cb) {
            var _this = this;

            cb = cb || _underscore2['default'].noop;
            return new _Promise(function (resolve, reject) {
                _get(Object.getPrototypeOf(PromiseAwareRequest.prototype), 'end', _this).call(_this, function (err, res) {
                    if (err) {
                        reject(err, res);
                    } else {
                        resolve(res);
                    }

                    cb.apply(null, [err, res]);
                });
            });
        }
    }]);

    return PromiseAwareRequest;
})(ParseAwareRequest);

var Relay = (function (_EventEmitter) {
    function Relay() {
        var config = arguments[0] === undefined ? {} : arguments[0];

        _classCallCheck(this, Relay);

        _get(Object.getPrototypeOf(Relay.prototype), 'constructor', this).call(this);
        this.config = _underscore2['default'].defaults(config, { apiUrl: '' });
        this._requestsInProgress = 0;
        this._bindToEvents();
    }

    _inherits(Relay, _EventEmitter);

    _createClass(Relay, [{
        key: '_requestStarted',
        value: function _requestStarted() {
            this._requestsInProgress++;
            return this;
        }
    }, {
        key: '_requestFinished',
        value: function _requestFinished() {
            if (this._requestsInProgress > 0) {
                this._requestsInProgress--;
                if (this._requestsInProgress == 0) {
                    this.emit('requestsFinish');
                }
            }

            return this;
        }
    }, {
        key: '_bindToEvents',
        value: function _bindToEvents() {

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
        }
    }, {
        key: '_addMethod',

        /**
         *
         * @param {object} options
         * @param {string} [options.name=resourceName_methodName] This will identify resource uniquely ex: comments_get
         * @param {string} options.resourceName this is the resource ex: comments
         * @param {string} options.methodName this is the method name ex: create
         * @param {string} [options.method=GET] this is request method ex: 'GET','PUT', 'POST' etc.,
         * @param {string} options.path ex: '/comments' or '/comments/{id}, 'comments/create'
         * @param {array} [options.parse]
         */
        value: function _addMethod(options) {
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

            this[options.resourceName] = this[options.resourceName] || {};
            this[options.resourceName][options.methodName] = this[options.name] = this._generateRequestMethod(_underscore2['default'].clone(options));

            return this;
        }
    }, {
        key: '_toURL',
        value: function _toURL(path, params) {

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
        }
    }, {
        key: '_sanitizeQueryParams',
        value: function _sanitizeQueryParams(params) {
            _underscore2['default'].each(params, function (val, key) {
                if (_underscore2['default'].isEmpty(val) && !_underscore2['default'].isNumber(val)) {
                    delete params[key];
                }
            });

            return params;
        }
    }, {
        key: '_generateRequestMethod',
        value: function _generateRequestMethod(options) {

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

                var _request = new PromiseAwareRequest(options.method, relay._toURL(options.path, data || {}));
                _request.addParsers(options.parse);

                if (data) {
                    switch (options.method.toLowerCase()) {
                        case 'get':
                        case 'head':
                        case 'delete':
                            relay._sanitizeQueryParams(data);
                            _request.query(data);
                            break;
                        case 'post':
                        case 'put':
                            _request.send(data);

                    }
                }

                _request.on('abort', function () {
                    relay.emit('abort', options, _superagent2['default']);
                });

                _request.on('request', function () {
                    relay.emit('request', options, _request);
                });

                relay.emit('beforeRequest', options, _request);

                _request.end = _underscore2['default'].wrap(_request.end, function (wrappedEnd, cb) {
                    cb = cb || _underscore2['default'].noop;
                    return wrappedEnd.call(_request, function (err, res) {
                        if (err) {
                            relay.emit('error', options, _request, res, err);
                        } else {
                            relay.emit('response', options, _request, res);
                        }

                        cb.apply(null, [err, res]);
                    });
                });

                if (callEnd) {
                    return _request.end(cb);
                }

                // return request so user can modify and call end when ready
                return _request;
            };
        }
    }], [{
        key: 'fromSchema',

        /**
         * Example Schema:
         *
         * {
         *  'comments': {
         *        'create' : {
         *           path: '/comments',
         *           method: 'POST', //optional defaults to GET
         *           parse: [], optional array of callbacks or callback function signature: function(res){return res;}
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
        value: function fromSchema(schema, config) {
            var relay = new Relay(config);
            _underscore2['default'].each(schema, function (methods, resourceName) {
                _underscore2['default'].each(methods, function (methodConfig, methodName) {
                    methodConfig.resourceName = resourceName;
                    methodConfig.methodName = methodName;
                    relay._addMethod(methodConfig);
                });
            });

            return relay;
        }
    }]);

    return Relay;
})(_eventemitter32['default']);

exports['default'] = Relay;
module.exports = exports['default'];