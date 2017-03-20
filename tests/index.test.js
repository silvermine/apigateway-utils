'use strict';

var expect = require('expect.js'),
    lib = require('../src/index');

describe('library entry point', function() {

   it('exports an object with a "get" function', function() {
      expect(lib).to.be.an('object');
      expect(lib.get).to.be.a('function');
   });

   it('returns exportable resources', function() {
      expect(lib.get('Request')).to.be.a('function');
      expect(lib.get('JWTSecuredRequest')).to.be.a('function');
      expect(lib.get('responseBuilderHandler')).to.be.a('function');
   });

   it('does not return resources that do not exist or are not exportable', function() {
      expect(lib.get.bind(lib, 'Foo')).to.throwError();
      expect(lib.get.bind(lib, 'Bar')).to.throwError();
      expect(lib.get.bind(lib, '')).to.throwError();
      expect(lib.get.bind(lib)).to.throwError();
      expect(lib.get.bind(lib, undefined)).to.throwError();
      expect(lib.get.bind(lib, null)).to.throwError();
   });

});
