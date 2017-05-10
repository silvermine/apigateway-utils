'use strict';

var _ = require('underscore'),
    Q = require('q'),
    Class = require('class.extend'),
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

   describe('error handling', function() {
      var expectedErr = new Error('ExpectedThisError'),
          rejectWithErrorFn;

      rejectWithErrorFn = function() {
         var def = Q.defer();

         setTimeout(function() {
            def.reject(expectedErr);
         }, 3);

         return def.promise;
      };

      it('uses a response builder to build an error response for any error that is thrown', function(done) {
         var cb;

         cb = function(err, resp) {
            expect(err).to.be(undefined);
            expect(resp).to.eql(respBuilder.error().toResponse(req));
            done();
         };

         handler(rejectWithErrorFn, req, cb);
      });

      it('allows a custom response builder class to be used when it creates a response for an otherwise uncaught error', function(done) {
         var toResponseStub = sinon.stub(),
             errorStub = sinon.stub(),
             CustomResponseBuilder, cb;

         CustomResponseBuilder = Class.extend({
            error: function() {
               errorStub.apply(this, arguments);
               return this;
            },
            toResponse: toResponseStub,
         });

         toResponseStub.returns('this is the custom response');

         cb = function(err, resp) {
            expect(err).to.be(undefined);
            expect(resp).to.eql('this is the custom response');
            sinon.assert.calledOnce(errorStub);
            sinon.assert.calledWithExactly(errorStub);
            sinon.assert.calledOnce(toResponseStub);
            sinon.assert.calledWithExactly(toResponseStub, req);
            done();
         };

         handler(rejectWithErrorFn, req, cb, CustomResponseBuilder);
      });

   });

});
