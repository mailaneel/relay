var Relay = require('../relay');
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
            var relay = Relay.fromSchema(schema, config);
            assert.instanceOf(relay, Relay);
            assert.isDefined(relay.api.comments);
            assert.isFunction(relay.api.comments.get);
            assert.isFunction(relay.api.comments_get);
        });
    });

    describe('#addMethod', function () {

        it('should throw if missing required params', function () {
            var relay = new Relay(config);
            assert.throw(relay.addMethod, Error);
        });

        it('should add method to api using', function () {
            var relay = new Relay(config);
            relay.addMethod(getMethod());
            assert.isDefined(relay.api.comments);
            assert.isFunction(relay.api.comments.get);
            assert.isFunction(relay.api.comments_get);
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
            var relay = new Relay(config);
            var method = getMethod();
            relay.addMethod(method);

            assert.instanceOf(relay.api.comments_get(false), request.Request);
            assert.instanceOf(relay.api.comments_get({}, false), request.Request);
        });

        it('should return a Promise when no parameters or just data is given as first parameter', function(){
            var relay = new Relay(config);
            var method = getMethod();
            relay.addMethod(method);

            assert.instanceOf(relay.api.comments_get(), Promise);
            assert.instanceOf(relay.api.comments_get({}), Promise);

        });

        it('should send request when api method with out parameters and return promise', function (done) {

            var relay = new Relay(config);
            var method = getMethod();
            relay.addMethod(method);

            relay.api.comments_get().then(function (res) {
                assert.equal(res.body[0].comment, 'This is test comment');
                done();
            });

        });

        it('should not send request when sendRequest is false, return Request to modify headers or any thing required', function (done) {
            var relay = new Relay(config);
            var method = getMethod();
            relay.addMethod(method);

            var req = relay.api.comments_get(false);
            req.end().then(function (res) {
                assert.equal(res.body[0].comment, 'This is test comment');
                done();
            });

        });

        it('should call parse if exist in method options and return data from parse', function (done) {
            var relay = new Relay(config);
            var method = getMethod();
            method.parse = sinon.stub().returns([{id: 1, comment: 'This is parsed comment'}]);
            relay.addMethod(method);

            relay.api.comments_get().then(function (res) {
                assert(method.parse.called);
                assert.equal(res.body[0].comment, 'This is parsed comment');
                done();
            });
        });

        it('should call array of parses if exist and return data from parse', function (done) {
            var relay = new Relay(config);
            var method = getMethod();
            var parse1 = sinon.stub().returns([{id: 1, comment: 'This is parsed1 comment'}]);
            var parse2 = sinon.stub().returns([{id: 1, comment: 'This is parsed2 comment'}]);
            method.parse = [parse1, parse2];
            relay.addMethod(method);

            relay.api.comments_get().then(function (res) {
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

            var relay = new Relay(config);
            var method = getMethod();
            relay.addMethod(method);

            relay.on('beforeRequest', function (options, req) {
                //this can be used to set timeout or modify properties of a request
                req.timeout(1000);
                done()
            });

            assert.instanceOf(relay.api.comments_get(), Promise);
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

            var relay = new Relay(config);
            var method = getMethod();
            relay.addMethod(method);

            relay.on('request', function () {
                done()
            });

            assert.instanceOf(relay.api.comments_get(), Promise);
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

            var relay = new Relay(config);
            var method = getMethod();
            relay.addMethod(method);

            relay.on('response', function () {
                done()
            });

            relay.api.comments_get();
            nock.cleanAll();
        });
    });

    describe('#event-error', function () {

        it('should be able to listen to all errors', function (done) {
            nock('http://test.com')
                .get('/comments')
                .reply(404, 'some error');

            var relay = new Relay(config);
            var method = getMethod();
            relay.addMethod(method);

            relay.on('error', function () {
                done()
            });

            relay.api.comments_get();
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

            var relay = new Relay(config);
            var method = getMethod();
            relay.addMethod(method);

            relay.on('requestsFinish', function () {
                assert.equal(0, relay._requestsInProgress);
                done()
            });

            relay.api.comments_get();
            assert.equal(1, relay._requestsInProgress);

            nock.cleanAll();
        });

        it('calling abort on request should decrease number of pending requests', function (done) {
            nock('http://test.com')
                .get('/comments')
                .reply(200, [{
                    id: 1,
                    comment: 'This is test comment'
                }]);

            var relay = new Relay(config);
            var method = getMethod();
            relay.addMethod(method);

            relay.on('requestsFinish', function () {
                assert.equal(0, relay._requestsInProgress);
                done()
            });

            relay.on('request', function(options, request){
                assert.equal(1, relay._requestsInProgress);
                request.abort();
            });

            relay.api.comments_get();
            nock.cleanAll();
        });
    });



});
