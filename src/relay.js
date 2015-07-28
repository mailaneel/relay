import superagent from 'superagent';
import _ from 'underscore';
import EventEmitter from 'eventemitter3';

export default class Relay extends EventEmitter {

    /**
     * Example Schema:
     *
     * {
     *  comments: {
     *        create : {
     *           path: '/comments',
     *           method: 'POST', //optional defaults to GET
     *           parse: function(res){}, optional callback:  function signature: function(res){return res;}
     *        }
     *   }
     * }
     *
     * above schema will be available as method
     * relay.api.comments.create()
     *
     * @param schema
     * @param config
     * @returns {Relay}
     */
    static fromSchema(schema, config) {
        var relay = new Relay(config);
        _.each(schema, function (methods, resourceName) {
            _.each(methods, function (methodConfig, methodName) {
                methodConfig.resourceName = resourceName;
                methodConfig.methodName = methodName;
                relay._addMethod(methodConfig);
            });
        });

        return relay;
    }

    /**
     * This should be used when you want to apply handler for all requests i.e by extending Request.prototype
     * @param handler
     */
    static use(handler) {
        handler.call(null, superagent);
    }

    static parser(request) {
        request.end = _.wrap(request.end, function (wrappedEnd, cb) {
            cb = cb || _.noop;
            return wrappedEnd.call(request, function (err, res) {
                if (!err && res.ok) {
                    if (request.options.parse && _.isFunction(request.options.parse) && res.body && !res.body.__parsed) {
                        res.body = request.options.parse(res.body);
                        if (res.body) {
                            res.body.__parsed = true;
                        }
                    }
                }

                cb.apply(null, [err, res]);
            });
        });
    }

    static promisify(request) {
        request.end = _.wrap(request.end, function (wrappedEnd, cb) {
            cb = cb || _.noop;
            return new Promise(function (resolve, reject) {
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
    }

    constructor(config = {}) {
        super();
        this.config = _.defaults(config, {apiUrl: ''});
        this._requestsInProgress = 0;

        this.middlewares = [Relay.parser, Relay.promisify];

        // this can be used as extension point to add cache wrapper etc.,
        this.api = {};

        this._bindToEvents();
    }

    use(fn) {
        this.middlewares.push(fn);
        return this;
    }

    _requestStarted() {
        this._requestsInProgress++;
        return this
    }

    _requestFinished() {
        if (this._requestsInProgress > 0) {
            this._requestsInProgress--;
            if (this._requestsInProgress == 0) {
                this.emit('requestsFinish');
            }
        }

        return this;
    }

    _bindToEvents() {

        var self = this;

        this.on('beforeRequest', function () {

        });

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


    /**
     *
     * @param {object} options
     * @param {string} options.resourceName this is the resource ex: comments
     * @param {string} options.methodName this is the method name ex: create
     * @param {string} [options.method=GET] this is request method ex: 'GET','PUT', 'POST' etc.,
     * @param {string} options.path ex: '/comments' or '/comments/{id}, 'comments/create'
     * @param {function} [options.parse]
     */
    _addMethod(options) {
        options = options || {};

        if (!options.resourceName) {
            throw new Error('resource name is required');
        }

        if (!options.methodName) {
            throw new Error('method name is required');
        }

        if (!options.path) {
            throw new Error('path is required');
        }

        if (!options.method) {
            options.method = 'GET';
        }


        this.api[options.resourceName] = this.api[options.resourceName] || {};
        this.api[options.resourceName][options.methodName] = this._generateRequestMethod(_.clone(options));

        return this;
    }

    _toURL(path, params) {

        if (!_.isObject(params)) {
            params = {};
        }

        var matches = path.split('/:');
        _.each(params, function (val, key) {
            path = path.replace('/:' + key, '/' + val);
        });

        _.each(matches, function (val) {
            if (_.indexOf(_.keys(params), val) !== -1) {
                delete params[val];
            }
        });

        if (path.indexOf(':') != -1) {
            throw new Error('missing parameters for url: ' + path);
        }

        return this.config.apiUrl + path;
    }

    _sanitizeQueryParams(params) {
        _.each(params, function (val, key) {
            if (_.isEmpty(val) && !_.isNumber(val)) {
                delete params[key];
            }
        });

        return params;
    }

    _generateRequestMethod(options) {

        var relay = this;

        /**
         * Example usage:
         *
         *  false as first or second parameter to method will return request for modification, it allows us to modify request.
         *  When ready to send request call end()  with or without callback.. end() will always return promise
         *
         *  var request = api.comments.get({count:1}, false);
         *  request.query({session_id: 1234});
         *  var promise = request.end();
         *  promise.then(function(res){});
         *
         *  if there is no need to modify request
         *
         *  var promise = api.comments.get({count:1});
         *  promise.then(function(res){});
         *
         *  or if there are no query params
         *
         *  var promise = api.comments.get();
         *  promise.then(function(res){});
         *
         *  or if you like node like callbacks
         *
         *  api.comments.get({count:1}, function(err, res){});
         *
         *  or
         *
         *  api.comments.get({count:1}, false).end(function(err, res){});
         *
         * data is optional, so you can pass callback or false as first parameter as well if needed.
         * @param {object|boolean|function} [data] data to sent to server
         * @param {boolean|function} [sendRequest=true]
         */
        return function (data = {}, sendRequest = true) {

            if (arguments.length == 1 && (_.isBoolean(data) || _.isFunction(data))) {
                sendRequest = data;
                data = {};
            }

            var callEnd = (sendRequest !== false);
            var cb = (_.isFunction(sendRequest)) ? sendRequest : null;

            var request = new superagent.Request(options.method, relay._toURL(options.path, (data || {})));

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

            //add middlewares
            _.each(relay.middlewares, function (middleware) {
                request.use(middleware);
            });

            request.end = _.wrap(request.end, function (wrappedEnd, cb) {
                cb = cb || _.noop;
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
    }
}
