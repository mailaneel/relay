var Relay = require('../index');
var nock = require('nock');
var sinon = require('sinon');
var assert = require('chai').assert;
var superagent = require('superagent');


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
            assert.isDefined(relay.api().comments);
            assert.isFunction(relay.api().comments.get);
            assert.isFunction(relay.api().comments_get);
        });
    });

    describe('#_addMethod', function () {

        it('should throw if missing required params', function () {
            var relay = new Relay(config);
            assert.throw(relay._addMethod, Error);
        });

        it('should add method to api using addMethod', function () {
            var relay = new Relay(config);
            relay._addMethod(getMethod());
            assert.isDefined(relay.api().comments);
            assert.isFunction(relay.api().comments.get);
            assert.isFunction(relay.api().comments_get);
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

    describe('#api', function(){

        it('should return api when no params are given', function(){
            var relay = Relay.fromSchema(schema, config);
            assert.equal(relay._api, relay.api());
            assert.equal(relay._api['comments'], relay.api('comments'));
            assert.equal(relay._api['comments']['get'], relay.api('comments', 'get'));
            assert.equal(relay._api['comments_get'], relay.api('comments', 'get'));
            assert.equal(relay._api['comments_get'], relay.api('comments_get'));
        });
    });

    describe('#methods', function(){

        it('alias to #api', function(){
            var relay = Relay.fromSchema(schema, config);
            assert.equal(relay._api, relay.methods());
            assert.equal(relay._api['comments'], relay.methods('comments'));
            assert.equal(relay._api['comments']['get'], relay.methods('comments', 'get'));
            assert.equal(relay._api['comments_get'], relay.methods('comments', 'get'));
            assert.equal(relay._api['comments_get'], relay.methods('comments_get'));
        });
    });

    describe('#Relay.use', function(){

        it('should call the handler with superagent as param', function(done){
            Relay.use(function(agent){
                assert.equal(superagent, agent);
                done();
            });

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
            relay._addMethod(method);

            assert.instanceOf(relay.api().comments_get(false), superagent.Request);
            assert.instanceOf(relay.api().comments_get({}, false), superagent.Request);
        });

        it('should return a Promise when no parameters or just data is given as first parameter', function(){
            var relay = new Relay(config);
            var method = getMethod();
            relay._addMethod(method);

            assert.instanceOf(relay.api().comments_get(), Promise);
            assert.instanceOf(relay.api().comments_get({}), Promise);

        });

        it('should send request when api method is called with out parameters and return promise', function (done) {

            var relay = new Relay(config);
            var method = getMethod();
            relay._addMethod(method);

            relay.api().comments_get().then(function (res) {
                console.log(res)
                assert.equal(res[0].comment, 'This is test comment');
                done();
            });

        });

        it('should not send request when sendRequest is false, return Request to modify headers or any thing required', function (done) {
            var relay = new Relay(config);
            var method = getMethod();
            relay._addMethod(method);

            var req = relay.api().comments_get(false);
            req.end().then(function (res) {
                assert.equal(res[0].comment, 'This is test comment');
                done();
            });

        });

        it('should call parse if exist in method options and return data from parse', function (done) {
            var relay = new Relay(config);
            var method = getMethod();
            method.parse = sinon.stub().returns([{id: 1, comment: 'This is parsed comment'}]);
            relay._addMethod(method);

            relay.api().comments_get().then(function (res) {
                assert(method.parse.called);
                assert.equal(res[0].comment, 'This is parsed comment');
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
            relay._addMethod(method);

            relay.on('beforeRequest', function (req) {
                //this can be used to set timeout or modify properties of a request
                req.timeout(1000);
                done()
            });

            assert.instanceOf(relay.api().comments_get(), Promise);
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
            relay._addMethod(method);

            relay.on('request', function () {
                done()
            });

            assert.instanceOf(relay.api().comments_get(), Promise);
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
            relay._addMethod(method);

            relay.on('response', function () {
                done()
            });

            relay.api().comments_get();
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
            relay._addMethod(method);

            relay.on('error', function () {
                done()
            });

            relay.api().comments_get();
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
            relay._addMethod(method);

            relay.on('requestsFinish', function () {
                assert.equal(0, relay._requestsInProgress);
                done()
            });

            relay.api().comments_get();
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
            relay._addMethod(method);

            relay.on('requestsFinish', function () {
                assert.equal(0, relay._requestsInProgress);
                done()
            });

            relay.on('request', function(request){
                assert.equal(1, relay._requestsInProgress);
                request.abort();
            });

            relay.api().comments_get();
            nock.cleanAll();
        });
    });



});
