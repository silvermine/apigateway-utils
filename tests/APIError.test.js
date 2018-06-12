'use strict';

var _ = require('underscore'),
    expect = require('expect.js'),
    APIError = require('../src/APIError');

describe('APIError', function() {
   var err;

   beforeEach(function() {
      err = new APIError('title', 'detail');
   });

   describe('rb', function() {
      it('returns the ResponseBuilder that was passed into the constructor', function() {
         var fakeRB = {};

         expect(err.rb()).to.be(undefined);
         err = new APIError('title', 'detail', 404, fakeRB);
         expect(err.rb()).to.be(fakeRB);
      });
   });

   describe('title', function() {
      it('sets the title', function() {
         expect(err._title).to.eql('title');
         err.title('foo');
         expect(err._title).to.eql('foo');
      });

      it('returns the error itself', function() {
         expect(err.title('foo')).to.be(err);
      });
   });

   describe('detail', function() {
      it('sets the detail', function() {
         expect(err._detail).to.eql('detail');
         err.detail('foo');
         expect(err._detail).to.eql('foo');
      });

      it('returns the error itself', function() {
         expect(err.detail('foo')).to.be(err);
      });
   });

   describe('status', function() {
      it('returns the status if called with no args, sets it if called with arg', function() {
         expect(err._status).to.be(undefined);
         expect(err.status()).to.be(undefined);
         err.status(999);
         expect(err._status).to.be(999);
         expect(err.status()).to.be(999);
      });
   });

   describe('addSource', function() {
      it('adds a source object', function() {
         expect(err._sources).to.eql([]);
         err.addSource('l', 'p', 'd', 's');
         expect(err._sources).to.eql([
            {
               location: 'l',
               path: 'p',
               detail: 'd',
               schemaPath: 's',
            },
         ]);
      });
   });

   describe('toResponseObject', function() {
      it('omits undefined detail', function() {
         err = new APIError('t2');

         expect(_.omit(err.toResponseObject(), 'id')).to.eql({
            title: 't2',
         });
      });

      it('omits an empty sources array and undefined status', function() {
         expect(err._sources).to.eql([]);
         expect(err.status()).to.be(undefined);

         expect(_.omit(err.toResponseObject(), 'id')).to.eql({
            title: 'title',
            detail: 'detail',
         });

         err.status(999);

         expect(_.omit(err.toResponseObject(), 'id')).to.eql({
            title: 'title',
            detail: 'detail',
            status: 999,
         });

         err.addSource('l', 'p', 'd', 's');
         expect(_.omit(err.toResponseObject(), 'id')).to.eql({
            title: 'title',
            detail: 'detail',
            status: 999,
            sources: [
               {
                  location: 'l',
                  path: 'p',
                  detail: 'd',
                  schemaPath: 's',
               },
            ],
         });
      });
   });

});
