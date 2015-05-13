import request from 'superagent';
import _ from 'underscore';
import EventEmitter from 'eventemitter3';


class ParseAwareRequest extends request.Request {

    addParsers(parsers) {
        this._parseAwareParsers = this._parseAwareParsers || [];

        var self = this;
        if (parsers) {
            if (_.isFunction(parsers)) {
                self._parseAwareParsers.push(parsers);
            }

            if (_.isArray(parsers)) {
                _.each(parsers, function (parser) {
                    self._parseAwareParsers.push(parser);
                });
            }
        }

        return this;
    }

    getParsers() {
        return this._parseAwareParsers || [];
    }

    /**
     *
     * @param cb
     * @returns {*}
     */
    end(cb) {
        cb = cb || _.noop;
        var parsers = this.getParsers();
        return super.end(function (err, res) {
            if (!err && res.ok) {
                // call parse handlers
                _.each(parsers, function (parser) {
                    res.body = parser(res.body);
                });
            }

            cb.apply(null, [err, res]);
        });
    }
}


// promise should be the last one
// because promise will either resolve or reject by the time parsers are called
class PromiseAwareRequest extends ParseAwareRequest {

    end(cb) {
        cb = cb || _.noop;
        return new Promise(function (resolve, reject) {
            super.end(function (err, res) {
                if (err) {
                    reject(err, res);
                } else {
                    resolve(res);
                }

                cb.apply(null, [err, res]);
            });
        });
    }
}

export default class Relay extends EventEmitter {


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
    static fromSchema(schema, config) {
        var relay = new Relay(config);
        _.each(schema, function (methods, resourceName) {
            _.each(methods, function (methodConfig, methodName) {
                methodConfig.resourceName = resourceName;
                methodConfig.methodName = methodName;
                relay.addMethod(methodConfig);
            });
        });

        return relay;
    }

    constructor(config = {}) {
        super();
        this.config = _.defaults(config, {apiUrl: ''});
        this.api = {};
        this._requestsInProgress = 0;
        this._bindToEvents();
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
     * @param {string} [options.name=resourceName_methodName] This will identify resource uniquely ex: comments_get
     * @param {string} options.resourceName this is the resource ex: comments
     * @param {string} options.methodName this is the method name ex: create
     * @param {string} [options.method=GET] this is request method ex: 'GET','PUT', 'POST' etc.,
     * @param {string} options.path ex: '/comments' or '/comments/{id}, 'comments/create'
     * @param {array} [options.parse]
     */
    addMethod(options) {
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

        this.api[options.resourceName] = this.api[options.resourceName] || {};
        this.api[options.resourceName][options.methodName] = this.api[options.name] = this._generateRequestMethod(_.clone(options));

        return this;
    }

    _toURL(path, params) {
        _.each(params, function (key, val) {
            path = path.replace('/:' + key, '/' + val);
        });

        path = path.replace(/\/:.*\?/g, '/').replace(/\?/g, '');
        if (path.indexOf(':') != -1) {
            throw new Error('missing parameters for url: ' + path);
        }
        return this.config.apiUrl + path;
    }

    _generateRequestMethod(options) {

        var relay = this;

        /**
         * Example usage:
         *
         *  false as first or second parameter to method will return request for modification, it allows us to modify request.
         *  When ready to send request call end()  with or without callback.. end() will always return promise
         *
         *  var request = relay.api.comments_get({count:1}, false);
         *  request.query({session_id: 1234});
         *  var promise = request.end();
         *  promise.then(function(res){});
         *
         *  if there is no need to modify request
         *
         *  var promise = relay.api.comments_get({count:1});
         *  promise.then(function(res){});
         *
         *  or if there are no query params
         *
         *  var promise = relay.api.comments_get();
         *  promise.then(function(res){});
         *
         *  or if you like node like callbacks
         *
         *  relay.api.comments_get({count:1}, function(err, res){});
         *
         *  or
         *
         *  relay.api.comments_get({count:1}, false).end(function(err, res){});
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
            var cb = (_.isFunction(sendRequest))? sendRequest: null;

            var _request = new PromiseAwareRequest(options.method, relay._toURL(options.path, (data || {})));
            _request.addParsers(options.parse);

            if (data) {
                switch (options.method.toLowerCase()) {
                    case 'get':
                    case 'head':
                    case 'delete':
                        _request.query(data);
                        break;
                    case 'post':
                    case 'put':
                        _request.send(data);

                }
            }

            _request.on('abort', function () {
                relay.emit('abort', options, request);
            });

            _request.on('request', function () {
                relay.emit('request', options, _request);
            });

            relay.emit('beforeRequest', options, _request);

            _request.end = _.wrap(_request.end, function (wrappedEnd, cb) {
                cb = cb || _.noop;
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

}