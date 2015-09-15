var Relay = require('../index');
var nock = require('nock');
var sinon = require('sinon');
var assert = require('chai').assert;
var superagent = require('superagent');
var isPromise = require('is-promise');

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
  return {
    resourceName: 'comments',
    methodName: 'get',
    path: '/comments'
  }
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
      assert.isDefined(relay.api.comments);
      assert.isFunction(relay.api.comments.get);
    });
  });


  describe('#_toURL', function () {

    it('should replace url named params and return full path', function () {
      var api = new Relay(config);
      var testData = [
        ['/:id', {
          id: 1
        }],
        ['/:id/:name', {
          id: 1,
          name: 'a'
        }],
        ['/test/:id/action', {
          id: 1
        }]
      ];

      assert.equal(api._toURL(testData[0][0], testData[0][1]), 'http://test.com/1');
      assert.isUndefined(testData[0][1]['id']);

      assert.equal(api._toURL(testData[1][0], testData[1][1]), 'http://test.com/1/a');
      assert.isUndefined(testData[1][1]['id']);
      assert.isUndefined(testData[1][1]['name']);
      assert.equal(api._toURL(testData[2][0], testData[2][1]), 'http://test.com/test/1/action');
      assert.isUndefined(testData[2][1]['id']);
      assert.isUndefined(testData[2][1]['name']);
    });
  });


  describe('#Relay.use', function () {

    it('should call the handler with superagent as param', function (done) {
      Relay.use(function (agent) {
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

    it('should return Request type when false is passed as first or second parameter', function () {
      var relay = new Relay(config);
      var method = getMethod();
      relay._addMethod(method);

      assert.instanceOf(relay.api.comments.get(false), superagent.Request);
      assert.instanceOf(relay.api.comments.get({}, false), superagent.Request);
    });

    it('should return a Promise when no parameters or just data is given as first parameter', function () {
      var relay = new Relay(config);
      var method = getMethod();
      relay._addMethod(method);
      assert.isTrue(isPromise(relay.api.comments.get()));
      assert.isTrue(isPromise(relay.api.comments.get({})));

    });

    it('should send request when api method is called with out parameters and return promise', function (done) {

      var relay = new Relay(config);
      var method = getMethod();
      relay._addMethod(method);

      relay.api.comments.get().then(function (res) {
        assert.equal(res[0].comment, 'This is test comment');
        done();
      });

    });

    it('should not send request when sendRequest is false, return Request to modify headers or any thing required', function (done) {
      var relay = new Relay(config);
      var method = getMethod();
      relay._addMethod(method);

      var req = relay.api.comments.get(false);
      req.end().then(function (res) {
        assert.equal(res[0].comment, 'This is test comment');
        done();
      });

    });

    it('should call parse if exist in method options and return data from parse', function (done) {
      var relay = new Relay(config);
      var method = getMethod();
      method.parse = sinon.stub().returns([{
        id: 1,
        comment: 'This is parsed comment'
      }]);
      relay._addMethod(method);

      relay.api.comments.get().then(function (res) {
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

      relay.api.comments.get();
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

      relay.api.comments.get();
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

      relay.api.comments.get();
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

      relay.api.comments.get();
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

      relay.api.comments.get();
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

      relay.on('request', function (request) {
        assert.equal(1, relay._requestsInProgress);
        request.abort();
      });

      relay.api.comments.get();
      nock.cleanAll();
    });
  });



});
