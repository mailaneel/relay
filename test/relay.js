var Relay = require('../index');
var nock = require('nock');
var sinon = require('sinon');
var assert = require('chai').assert;
var request = require('superagent');


var schema = {
    comments: {
        get: {
            path: '/comments'
        }
    }
};

var config = {
    apiUrl: 'http://test.com'
};


function getMethod() {
    return {resourceName: 'comments', methodName: 'get', path: '/comments'}
}

var errorNock = function () {
    nock('http://test.com')
        .get('/comments')
        .reply(404, 'some error');
};

describe('Relay', function () {

    it('should be loaded and defined for use', function () {
        assert.isDefined(Relay);
    });

    describe('#fromSchema', function () {
        it('should create api #fromSchema', function () {
            var api = Relay.fromSchema(schema, config);
            assert.instanceOf(api, Relay);
            assert.isDefined(api.comments);
            assert.isFunction(api.comments.get);
            assert.isFunction(api.comments_get);
        });
    });

    describe('#_addMethod', function () {

        it('should throw if missing required params', function () {
            var api = new Relay(config);
            assert.throw(api._addMethod, Error);
        });

        it('should add method to api using', function () {
            var api = new Relay(config);
            api._addMethod(getMethod());
            assert.isDefined(api.comments);
            assert.isFunction(api.comments.get);
            assert.isFunction(api.comments_get);
        });
    });


    describe('#_toURL', function () {


        it('should replace url named params and return full path', function () {
            var api = new Relay(config);
            var data = {id: 1};
            var fullUrl = api._toURL('/:id', data);
            assert.equal(fullUrl, 'http://test.com/1');
            assert.isUndefined(data['id']);
        });
    });


    describe("#added-api-methods", function () {

        beforeEach(function () {
            nock('http://test.com')
                .persist()
                .get('/comments')
                .reply(200, [{
                    id: 1,
                    comment: 'This is test comment'
                }]);
        });

        afterEach(function () {
            nock.cleanAll();
        });

        it('should return Request type when false is passed as first or second parameter', function(){
            var api = new Relay(config);
            var method = getMethod();
            api._addMethod(method);

            assert.instanceOf(api.comments_get(false), request.Request);
            assert.instanceOf(api.comments_get({}, false), request.Request);
        });

        it('should return a Promise when no parameters or just data is given as first parameter', function(){
            var api = new Relay(config);
            var method = getMethod();
            api._addMethod(method);

            assert.instanceOf(api.comments_get(), Promise);
            assert.instanceOf(api.comments_get({}), Promise);

        });

        it('should send request when api method is called with out parameters and return promise', function (done) {

            var api = new Relay(config);
            var method = getMethod();
            api._addMethod(method);

            api.comments_get().then(function (res) {
                assert.equal(res.body[0].comment, 'This is test comment');
                done();
            });

        });

        it('should not send request when sendRequest is false, return Request to modify headers or any thing required', function (done) {
            var api = new Relay(config);
            var method = getMethod();
            api._addMethod(method);

            var req = api.comments_get(false);
            req.end().then(function (res) {
                assert.equal(res.body[0].comment, 'This is test comment');
                done();
            });

        });

        it('should call parse if exist in method options and return data from parse', function (done) {
            var api = new Relay(config);
            var method = getMethod();
            method.parse = sinon.stub().returns([{id: 1, comment: 'This is parsed comment'}]);
            api._addMethod(method);

            api.comments_get().then(function (res) {
                assert(method.parse.called);
                assert.equal(res.body[0].comment, 'This is parsed comment');
                done();
            });
        });

        it('should call array of parses if exist and return data from parse', function (done) {
            var api = new Relay(config);
            var method = getMethod();
            var parse1 = sinon.stub().returns([{id: 1, comment: 'This is parsed1 comment'}]);
            var parse2 = sinon.stub().returns([{id: 1, comment: 'This is parsed2 comment'}]);
            method.parse = [parse1, parse2];
            api._addMethod(method);

            api.comments_get().then(function (res) {
                assert(parse1.called);
                assert(parse2.called);
                assert.equal(res.body[0].comment, 'This is parsed2 comment');
                done();
            });
        });
    });

    describe('#event-beforeRequest', function () {
        it('should be able to listen to all requests', function (done) {
            nock('http://test.com')
                .get('/comments')
                .delay(1500)
                .reply(200, [{
                    id: 1,
                    comment: 'This is test comment'
                }]);

            var api = new Relay(config);
            var method = getMethod();
            api._addMethod(method);

            api.on('beforeRequest', function (options, req) {
                //this can be used to set timeout or modify properties of a request
                req.timeout(1000);
                done()
            });

            assert.instanceOf(api.comments_get(), Promise);
            nock.cleanAll();
        });
    });

    describe('#event-request', function () {
        it('should be able to listen to all requests', function (done) {
            nock('http://test.com')
                .get('/comments')
                .reply(200, [{
                    id: 1,
                    comment: 'This is test comment'
                }]);

            var api = new Relay(config);
            var method = getMethod();
            api._addMethod(method);

            api.on('request', function () {
                done()
            });

            assert.instanceOf(api.comments_get(), Promise);
            nock.cleanAll();
        });
    });

    describe('#event-response', function () {
        it('should be able to listen to all responses', function (done) {
            nock('http://test.com')
                .get('/comments')
                .reply(200, [{
                    id: 1,
                    comment: 'This is test comment'
                }]);

            var api = new Relay(config);
            var method = getMethod();
            api._addMethod(method);

            api.on('response', function () {
                done()
            });

            api.comments_get();
            nock.cleanAll();
        });
    });

    describe('#event-error', function () {

        it('should be able to listen to all errors', function (done) {
            nock('http://test.com')
                .get('/comments')
                .reply(404, 'some error');

            var api = new Relay(config);
            var method = getMethod();
            api._addMethod(method);

            api.on('error', function () {
                done()
            });

            api.comments_get();
            nock.cleanAll();
        });
    });


    describe('#event-requestsFinish', function () {
        it('should be able to listen to request finishes i.e when there no requests pending', function (done) {
            nock('http://test.com')
                .get('/comments')
                .reply(200, [{
                    id: 1,
                    comment: 'This is test comment'
                }]);

            var api = new Relay(config);
            var method = getMethod();
            api._addMethod(method);

            api.on('requestsFinish', function () {
                assert.equal(0, api._requestsInProgress);
                done()
            });

            api.comments_get();
            assert.equal(1, api._requestsInProgress);

            nock.cleanAll();
        });

        it('calling abort on request should decrease number of pending requests', function (done) {
            nock('http://test.com')
                .get('/comments')
                .reply(200, [{
                    id: 1,
                    comment: 'This is test comment'
                }]);

            var api = new Relay(config);
            var method = getMethod();
            api._addMethod(method);

            api.on('requestsFinish', function () {
                assert.equal(0, api._requestsInProgress);
                done()
            });

            api.on('request', function(options, request){
                assert.equal(1, api._requestsInProgress);
                request.abort();
            });

            api.comments_get();
            nock.cleanAll();
        });
    });



});
