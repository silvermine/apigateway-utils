'use strict';

var Q = require('q'),
    expect = require('expect.js'),
    Request = require('../src/Request');

describe('Request', function() {

   describe('getEvent', function() {

      it('returns the event that was passed in', function() {
         var req = new Request({ foo: 'event-object' });

         expect(req.getEvent()).to.eql({ foo: 'event-object' });
      });

   });


   describe('getContext', function() {

      it('returns the context that was passed in', function() {
         var req = new Request({}, { foo: 'is-the-context' });

         expect(req.getContext()).to.eql({ foo: 'is-the-context' });
      });

   });


   describe('validateQueryParams', function() {
      var validationRules = { foo: { required: true, pattern: /^isFoo.*$/ }, bar: { required: true }, baz: { required: false } };

      it('marks as invalid params that are required and not supplied', function() {
         var req, validate;

         req = new Request({ queryStringParameters: { foo: 'isFoo' } });
         validate = req.validateQueryParams(validationRules);
         expect(validate).to.eql({ isValid: false, msg: 'Invalid required fields: bar' });

         req = new Request({});
         validate = req.validateQueryParams(validationRules);
         expect(validate).to.eql({ isValid: false, msg: 'Invalid required fields: foo, bar' });
      });

      it('marks as invalid params that are required and supplied, but empty', function() {
         var req, validate;

         req = new Request({ queryStringParameters: { foo: 'isFoo', bar: '' } });
         validate = req.validateQueryParams(validationRules);
         expect(validate).to.eql({ isValid: false, msg: 'Invalid required fields: bar' });

         req = new Request({ queryStringParameters: { foo: '', bar: 'something' } });
         validate = req.validateQueryParams(validationRules);
         expect(validate).to.eql({ isValid: false, msg: 'Invalid required fields: foo' });

         req = new Request({ queryStringParameters: { foo: '', bar: '' } });
         validate = req.validateQueryParams(validationRules);
         expect(validate).to.eql({ isValid: false, msg: 'Invalid required fields: foo, bar' });
      });

      it('marks as invalid params that are required and fail their regex rule', function() {
         var req, validate;

         req = new Request({ queryStringParameters: { foo: 'something', bar: 'something' } });
         validate = req.validateQueryParams(validationRules);
         expect(validate).to.eql({ isValid: false, msg: 'Invalid required fields: foo' });
      });

      it('returns valid response if all params pass validation', function() {
         var req, validate;

         req = new Request({ queryStringParameters: { foo: 'isFoo', bar: 'something' } });
         validate = req.validateQueryParams(validationRules);
         expect(validate).to.eql({ isValid: true, msg: undefined });

         req = new Request({ queryStringParameters: { foo: 'isFoo', bar: 'something', baz: 'something' } });
         validate = req.validateQueryParams(validationRules);
         expect(validate).to.eql({ isValid: true, msg: undefined });

         req = new Request({ queryStringParameters: { foo: 'isFooBar', bar: 'something', baz: 'something' } });
         validate = req.validateQueryParams(validationRules);
         expect(validate).to.eql({ isValid: true, msg: undefined });
      });

   });


   describe('hasPathParam', function() {

      it('returns correct values', function() {
         var req = new Request({ pathParameters: { foo: 'abc', bar: 'def' } });

         expect(req.hasPathParam('foo')).to.be(true);
         expect(req.hasPathParam('bar')).to.be(true);
         expect(req.hasPathParam('baz')).to.be(false);
      });

      it('returns correct values - when no path parameters existed in event', function() {
         var req = new Request({});

         expect(req.hasPathParam('foo')).to.be(false);
         expect(req.hasPathParam('bar')).to.be(false);
         expect(req.hasPathParam('baz')).to.be(false);
      });

   });


   describe('pathParam', function() {

      it('returns correct values', function() {
         var req = new Request({ pathParameters: { foo: 'abc', bar: 'def' } });

         expect(req.pathParam('foo')).to.eql('abc');
         expect(req.pathParam('bar')).to.eql('def');
         expect(req.pathParam('baz')).to.be(undefined);
      });

      it('returns undefined when no path parameters existed in event', function() {
         var req = new Request({});

         expect(req.pathParam('foo')).to.be(undefined);
         expect(req.pathParam('bar')).to.be(undefined);
         expect(req.pathParam('baz')).to.be(undefined);
      });

   });


   describe('hasQueryParam', function() {

      it('returns correct values', function() {
         var req = new Request({ queryStringParameters: { foo: 'abc', bar: 'def' } });

         expect(req.hasQueryParam('foo')).to.be(true);
         expect(req.hasQueryParam('bar')).to.be(true);
         expect(req.hasQueryParam('baz')).to.be(false);
      });

      it('returns correct values - when no query string parameters existed in event', function() {
         var req = new Request({});

         expect(req.hasQueryParam('foo')).to.be(false);
         expect(req.hasQueryParam('bar')).to.be(false);
         expect(req.hasQueryParam('baz')).to.be(false);
      });

   });


   describe('query', function() {

      it('returns correct values', function() {
         var req = new Request({ queryStringParameters: { foo: 'abc', bar: 'def', emptyString: '' } });

         expect(req.query('foo')).to.eql('abc');
         expect(req.query('bar')).to.eql('def');
         expect(req.query('emptyString')).to.eql('');
         expect(req.query('baz')).to.be(undefined);
      });

      it('returns undefined when no query string parameters existed in event', function() {
         var req = new Request({});

         expect(req.query('foo')).to.be(undefined);
         expect(req.query('bar')).to.be(undefined);
         expect(req.query('baz')).to.be(undefined);
      });

   });


   describe('context', function() {

      it('returns values from the context', function() {
         var req = new Request({}, { foo: 'abc', bar: 'def' });

         expect(req.context('foo')).to.eql('abc');
         expect(req.context('bar')).to.eql('def');
         expect(req.context('baz')).to.be(undefined);
      });

   });


   describe('body', function() {

      it('returns the event body', function() {
         var req = new Request({ body: 'abcdef' });

         expect(req.body()).to.eql('abcdef');
      });

   });


   describe('isBase64Encoded', function() {

      it('returns the event isBase64Encoded value as a boolean', function() {
         var req;

         req = new Request({ isBase64Encoded: false });
         expect(req.isBase64Encoded()).to.be(false);

         req = new Request({ isBase64Encoded: true });
         expect(req.isBase64Encoded()).to.be(true);

         req = new Request({});
         expect(req.isBase64Encoded()).to.be(false);
      });

   });


   describe('header', function() {

      it('returns correct values', function() {
         var req = new Request({ headers: { foo: 'abc', bar: 'def', emptyString: '' } });

         expect(req.header('foo')).to.eql('abc');
         expect(req.header('bar')).to.eql('def');
         expect(req.header('emptyString')).to.eql('');
         expect(req.header('baz')).to.be(undefined);
      });

      it('returns undefined when no headers existed in event', function() {
         var req = new Request({});

         expect(req.header('foo')).to.be(undefined);
         expect(req.header('bar')).to.be(undefined);
         expect(req.header('baz')).to.be(undefined);
      });

   });


   describe('path', function() {

      it('returns the event path', function() {
         var req = new Request({ path: '/abcdef' });

         expect(req.path()).to.eql('/abcdef');
      });

   });


   describe('method', function() {

      it('returns the event HTTP method', function() {
         var req = new Request({ httpMethod: 'GET' });

         expect(req.method()).to.eql('GET');
      });

   });


   describe('started', function() {
      this.slow(200);

      it('returns the time the request was created', function() {
         var start = new Date().getTime(),
             req = new Request({});

         return Q.delay(50)
            .then(function() {
               expect(req.started()).to.be.greaterThan(start - 1);
               expect(req.started()).to.be.lessThan(start + 100);
            });
      });

   });

});
