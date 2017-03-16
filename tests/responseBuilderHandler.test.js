'use strict';

var _ = require('underscore'),
    Q = require('q'),
    sinon = require('sinon'),
    expect = require('expect.js'),
    Request = require('../src/Request'),
    ResponseBuilder = require('../src/ResponseBuilder'),
    rewire = require('rewire'),
    handler = rewire('../src/responseBuilderHandler');

describe('responseBuilderHandler', function() {
   var context = { getRemainingTimeInMillis: _.noop },
       req, respBuilder, revert;

   beforeEach(function() {
      req = new Request({}, context);
      respBuilder = new ResponseBuilder();

      revert = handler.__set__({
         console: { log: _.noop },
      });
   });

   afterEach(function() {
      revert();
   });

   it('calls the function and passes the response from its return value to the callback', function(done) {
      var fn = sinon.stub(),
          cb;

      fn.returns(Q.delay(respBuilder, 3));

      cb = function(err, resp) {
         sinon.assert.calledOnce(fn);
         expect(err).to.be(undefined);
         expect(resp).to.eql(respBuilder.toResponse(req));
         done();
      };

      handler(fn, req, cb);
   });

   it('uses a response builder to build an error response for any error that is thrown', function(done) {
      var expectedErr = new Error('ExpectedThisError'),
          fn, cb;

      fn = function() {
         var def = Q.defer();

         setTimeout(function() {
            def.reject(expectedErr);
         }, 3);

         return def.promise;
      };

      cb = function(err, resp) {
         expect(err).to.be(undefined);
         expect(resp).to.eql(respBuilder.error().toResponse(req));
         done();
      };

      handler(fn, context, cb);
   });

});
