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
      var sharedRules;

      sharedRules = {
         foo: { required: true, pattern: /^isFoo.*$/ },
         bar: { required: true },
         baz: { required: false },
      };

      function runValidTest(rules, qp) {
         var req, validate;

         req = new Request({ queryStringParameters: qp });
         validate = req.validateQueryParams(rules);
         expect(validate).to.eql({ isValid: true });
      }

      function runInvalidTest(rules, qp, invalidFields) {
         var req, validate;

         req = new Request({ queryStringParameters: qp });
         validate = req.validateQueryParams(rules);
         expect(validate).to.eql({ isValid: false, msg: 'Invalid fields: ' + invalidFields });
      }

      it('marks as invalid params that are required and not supplied', function() {
         runInvalidTest(sharedRules, { foo: 'isFoo' }, 'bar');
         runInvalidTest(sharedRules, {}, 'foo, bar');
      });

      it('marks as invalid params that are required and supplied, but empty', function() {
         runInvalidTest(sharedRules, { foo: 'isFoo', bar: '' }, 'bar');
         runInvalidTest(sharedRules, { foo: '', bar: 'something' }, 'foo');
         runInvalidTest(sharedRules, { foo: '', bar: '' }, 'foo, bar');
      });

      it('marks as invalid params that are required and fail their regex rule', function() {
         runInvalidTest(sharedRules, { foo: 'something', bar: 'something' }, 'foo');
      });

      it('marks as invalid params that are required and fail min and max rules', function() {
         var rules;

         rules = JSON.parse(JSON.stringify(sharedRules));
         rules.foo = { required: true, min: 4, max: 8 };
         rules.bar = { required: true, min: -4, max: 0 };

         // foo is not a number
         runInvalidTest(rules, { foo: 'something', bar: '-2' }, 'foo');
         // foo is below range
         runInvalidTest(rules, { foo: '3', bar: '-2' }, 'foo');
         // foo is above range
         runInvalidTest(rules, { foo: '9', bar: '-2' }, 'foo');
         // foo has decimal separators
         runInvalidTest(rules, { foo: '99.9', bar: '-2' }, 'foo');
         runInvalidTest(rules, { foo: '8.0001', bar: '-2' }, 'foo');
         runInvalidTest(rules, { foo: '3.9999', bar: '-2' }, 'foo');

         // bar is not a number
         runInvalidTest(rules, { foo: '4', bar: 'something' }, 'bar');
         // bar is below range
         runInvalidTest(rules, { foo: '4', bar: '-5' }, 'bar');
         // bar is above range
         runInvalidTest(rules, { foo: '4', bar: '1' }, 'bar');
         // bar has decimal separators
         runInvalidTest(rules, { foo: '4', bar: '0.00001' }, 'bar');
         runInvalidTest(rules, { foo: '4', bar: '-4.00001' }, 'bar');

         // both foo and bar are not numbers
         runInvalidTest(rules, { foo: 'something', bar: 'something' }, 'foo, bar');
         // both foo and bar are out of range
         runInvalidTest(rules, { foo: '3', bar: '1' }, 'foo, bar');


         // thousands separators are treated as NaN
         rules = JSON.parse(JSON.stringify(sharedRules));
         rules.foo = { required: true, min: 0, max: 10000 };
         rules.bar = { required: true, min: -10000, max: 0 };

         runInvalidTest(rules, { foo: '9,999', bar: '-2' }, 'foo');
         runInvalidTest(rules, { foo: '9,999.99', bar: '-2' }, 'foo');
         runInvalidTest(rules, { foo: '2', bar: '-2,123' }, 'bar');
         runInvalidTest(rules, { foo: '2.99', bar: '-2,123.01' }, 'bar');
         runInvalidTest(rules, { foo: '1,234', bar: '-2,123.01' }, 'foo, bar');
      });

      it('returns valid response if all params pass validation - required and patterns', function() {
         runValidTest(sharedRules, { foo: 'isFoo', bar: 'something' });
         runValidTest(sharedRules, { foo: 'isFoo', bar: 'something', baz: 'something' });
         runValidTest(sharedRules, { foo: 'isFooBar', bar: 'something', baz: 'something' });
      });

      it('returns valid response if all params pass validation - min and max', function() {
         var rules;

         rules = JSON.parse(JSON.stringify(sharedRules));
         rules.foo = { required: true, min: 4, max: 8 };
         rules.bar = { required: true, min: -4, max: 0 };

         runValidTest(rules, { foo: '4', bar: '-4' });
         runValidTest(rules, { foo: '5', bar: '-4' });
         runValidTest(rules, { foo: '6', bar: '-4' });
         runValidTest(rules, { foo: '7', bar: '-4' });
         runValidTest(rules, { foo: '8', bar: '-4' });
         runValidTest(rules, { foo: '8', bar: '-3' });
         runValidTest(rules, { foo: '8', bar: '-2' });
         runValidTest(rules, { foo: '8', bar: '-1' });
         runValidTest(rules, { foo: '8', bar: '0' });

         // some decimals
         runValidTest(rules, { foo: '4.000001', bar: '-3.99' });
         runValidTest(rules, { foo: '7.99', bar: '-0.01' });
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

      it('ignores case when looking up values', function() {
         var req = new Request({ headers: { foo: 'abc', bar: 'def', emptyString: '' } });

         expect(req.header('FOO')).to.eql('abc');
         expect(req.header('Bar')).to.eql('def');
         expect(req.header('EmptyString')).to.eql('');
         expect(req.header('bAz')).to.be(undefined);
      });

      it('returns undefined when no (or falsy) key is provided', function() {
         var req = new Request({ headers: { foo: 'abc', bar: 'def', emptyString: '' } });

         expect(req.header()).to.be(undefined);
         expect(req.header(null)).to.be(undefined);
         expect(req.header(false)).to.be(undefined);
         expect(req.header(0)).to.be(undefined);
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
