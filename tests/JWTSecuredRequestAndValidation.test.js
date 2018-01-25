'use strict';

var _ = require('underscore'),
    fs = require('fs'),
    jwt = require('jwt-simple'),
    path = require('path'),
    expect = require('expect.js'),
    Request = require('../src/JWTSecuredRequest'),
    Validator = require('../src/JWTValidator'),
    INVALID_TOKEN = { jti: 'invalidToken' },
    DEFAULT_MAKE_TOKEN_OPTS = { isValidSignature: true, isBeforeNBF: false, isAfterEXP: false },
    publicKey = fs.readFileSync(path.join(__dirname, 'test-signing-key.pub')), // eslint-disable-line no-sync
    privateKey = fs.readFileSync(path.join(__dirname, 'test-signing-key')); // eslint-disable-line no-sync

/**
 * Public service announcement: you should already know this, but just in case you do not:
 * the keys that are used in this test suite should never be used in your real code since
 * the private key is publicly-available.
 */

function reverseSignature(token) {
   var parts = token.split('.');

   return parts[0] + '.' + parts[1] + '.' + parts[2].split('').reverse().join('');
}

function makeToken(userOpts, tokenFields) {
   var opts = _.extend({}, DEFAULT_MAKE_TOKEN_OPTS, userOpts),
       now = Math.floor(new Date().getTime() / 1000),
       obj, token;

   obj = {
      jti: 'ID-' + _.random(1, 9999999),
      nbf: opts.isBeforeNBF ? now + 15 : now - 15,
      exp: opts.isAfterEXP ? now - 15 : now + 15,
   };

   obj = _.extend({}, obj, tokenFields);

   token = jwt.encode(obj, privateKey, 'RS256');

   if (!opts.isValidSignature) {
      token = reverseSignature(token);
   }

   return { string: token, obj: obj };
}

describe('JWTValidator', function() {

   // NOTE: all the rest of the validator logic is validated below in the
   // JWTSecuredRequest validation tests

   it('validates a non-bearer token', function() {
      var validator = new Validator(publicKey),
          token = makeToken({}, { aud: 'MyAPI', iss: 'MyIssuer', jti: 'id-321' }),
          validation;

      validator.issuer('MyIssuer').audience('MyAPI').revocation([ 'id-123' ]);

      expect(validator.validate(token.string)).to.eql({ errors: [], token: token.obj });

      token = makeToken({}, { aud: 'MyAPI', iss: 'MyIssuer', jti: 'id-123' });
      validation = validator.validate(token.string);

      expect(validation.token).to.eql(token.obj);
      expect(validation.errors).to.be.an('array');
      expect(_.chain(validation.errors).invoke('toJSON').map(_.partial(_.omit, _, 'id')).value()).to.eql([
         { title: 'Invalid authorization token', detail: 'Token has been revoked' },
      ]);
   });

});

describe('JWTSecuredRequest', function() {

   describe('validateAuthorizationHeader', function() {

      function runTest(req, validationOpts) {
         // starting state
         expect(req.getToken()).to.eql(false);

         // manually set the token to something else so we can validate that the token
         // in the request is erased (reset to false) whenever we try to validate it
         // but it's not valid
         req._token = INVALID_TOKEN;
         expect(req.getToken()).to.eql(INVALID_TOKEN);

         return req.validateAuthorizationHeader(publicKey, validationOpts);
      }

      function runInvalidTokenTest(token, validationOpts, expectedErrorCount, fields) {
         var req = new Request({ headers: { Authorization: 'Bearer ' + token.string } }, {}),
             validation = runTest(req, validationOpts);

         expect(validation).to.be.an('object');
         expect(validation.errors).to.be.an('array');
         expect(validation.errors.length).to.be(expectedErrorCount);
         _.each(validation.errors, function(err, i) {
            var field = _.isArray(fields) ? fields[i] : false;

            expect(err._title).to.eql('Invalid authorization token');
            expect(err._detail).to.be.a('string');

            if (field) {
               expect(err._detail).to.eql(field === 'jti' ? 'Token has been revoked' : ('Invalid "' + field + '" value in the token.'));
            }
         });
         expect(req.getToken()).to.eql(false);
      }

      function runValidTokenTest(token, validationOpts) {
         var req = new Request({ headers: { Authorization: 'Bearer ' + token.string } }, {}),
             validation = runTest(req, validationOpts);

         expect(validation).to.be.an('object');
         expect(validation.errors).to.be.empty();
         expect(req.getToken()).to.eql(token.obj);
      }

      it('returns error and resets internal state when no header present', function() {
         var req = new Request({}, {}),
             validation = runTest(req);

         expect(validation.token).to.be(undefined);
         expect(_.chain(validation.errors).invoke('toJSON').map(_.partial(_.omit, _, 'id')).value()).to.eql([
            {
               title: 'No token supplied',
               sources: [ { location: 'header', path: 'Authorization' } ],
            },
         ]);
         expect(req.getToken()).to.eql(false);
      });

      it('returns error and resets internal state when no token present after "Bearer "', function() {
         var req = new Request({ headers: { Authorization: 'Bearer ' } }, {}),
             validation = runTest(req);

         expect(validation.token).to.be(undefined);
         expect(_.chain(validation.errors).invoke('toJSON').map(_.partial(_.omit, _, 'id')).value()).to.eql([
            {
               title: 'No token supplied',
               sources: [ { location: 'header', path: 'Authorization' } ],
            },
         ]);
         expect(req.getToken()).to.eql(false);
      });

      it('returns error and resets internal state when header has no Bearer prefix', function() {
         var token = makeToken(),
             req = new Request({ headers: { Authorization: token.string } }, {}),
             validation = runTest(req);

         expect(validation.token).to.be(undefined);
         expect(_.chain(validation.errors).invoke('toJSON').map(_.partial(_.omit, _, 'id')).value()).to.eql([
            {
               title: 'Authorization header not in correct format',
               sources: [ { location: 'header', path: 'Authorization' } ],
            },
         ]);
         expect(req.getToken()).to.eql(false);
      });

      it('returns error and resets internal state when now is before the "not before" in the token', function() {
         runInvalidTokenTest(makeToken({ isBeforeNBF: true }), {}, 1);
      });

      it('returns error and resets internal state when now is after the expiration in the token', function() {
         runInvalidTokenTest(makeToken({ isAfterEXP: true }), {}, 1);
      });

      it('returns error and resets internal state when token signature is incorrect', function() {
         runInvalidTokenTest(makeToken({ isValidSignature: false }), {}, 1);
      });

      it('returns error and resets internal state when audience is incorrect', function() {
         var token;

         token = makeToken({}, { aud: 'SomeOtherAPI' });
         runInvalidTokenTest(token, { audience: 'SomeExpectedAPI' }, 1);

         token = makeToken({}, { aud: [ 'SomeOtherAPI1', 'SomeOtherAPI2' ] });
         runInvalidTokenTest(token, { audience: 'SomeExpectedAPI' }, 1);
      });

      it('returns error and resets internal state when issuer does not match', function() {
         var token = makeToken({}, { iss: 'MyIssuer' });

         runInvalidTokenTest(token, { issuer: 'MyExpectedIssuer' }, 1);
      });

      it('returns error and resets internal state when token is revoked', function() {
         var token = makeToken({ isValidSignature: false });

         runInvalidTokenTest(token, { revokedTokenIDs: [ token.obj.jti ] }, 1);
      });

      it('returns multiple errors when there are multiple issues', function() {
         var token;

         token = makeToken();
         runValidTokenTest(token);

         token = makeToken({}, { aud: 'MyAPI', iss: 'MyIssuer', jti: 'id-123' });

         runInvalidTokenTest(token, { audience: 'MyOtherAPI', issuer: 'SomeIssuer' }, 2, [ 'iss', 'aud' ]);
         runInvalidTokenTest(token, { issuer: 'SomeIssuer', revokedTokenIDs: [ 'id-123' ] }, 2, [ 'iss', 'jti' ]);
         runInvalidTokenTest(token, { audience: 'MyOtherAPI', revokedTokenIDs: [ 'id-123' ] }, 2, [ 'aud', 'jti' ]);
         runInvalidTokenTest(
            token,
            { audience: 'MyOtherAPI', issuer: 'SomeIssuer', revokedTokenIDs: [ 'id-123' ] },
            3,
            [ 'iss', 'aud', 'jti' ]
         );
      });

      it('properly sets state for valid token', function() {
         var token;

         token = makeToken();
         runValidTokenTest(token);

         token = makeToken({}, { aud: 'MyAPI', iss: 'MyIssuer', jti: 'id-123' });

         runValidTokenTest(token, { audience: 'MyAPI' });
         runValidTokenTest(token, { issuer: 'MyIssuer' });
         runValidTokenTest(token, { revokedTokenIDs: [ 'id-456', 'id-789' ] });
         runValidTokenTest(token, { audience: 'MyAPI', issuer: 'MyIssuer' });
         runValidTokenTest(token, { audience: 'MyAPI', revokedTokenIDs: [ 'id-456', 'id-789' ] });
         runValidTokenTest(token, { issuer: 'MyIssuer', revokedTokenIDs: [ 'id-456', 'id-789' ] });
         runValidTokenTest(token, { audience: 'MyAPI', issuer: 'MyIssuer', revokedTokenIDs: [ 'id-456', 'id-789' ] });

         token = makeToken({}, { aud: [ 'MyAPI1', 'MyAPI2' ], iss: 'MyIssuer', jti: 'id-123' });

         runValidTokenTest(token, { audience: 'MyAPI1' });
         runValidTokenTest(token, { issuer: 'MyIssuer' });
         runValidTokenTest(token, { revokedTokenIDs: [ 'id-456', 'id-789' ] });
         runValidTokenTest(token, { audience: 'MyAPI1', issuer: 'MyIssuer' });
         runValidTokenTest(token, { audience: 'MyAPI1', revokedTokenIDs: [ 'id-456', 'id-789' ] });
         runValidTokenTest(token, { issuer: 'MyIssuer', revokedTokenIDs: [ 'id-456', 'id-789' ] });
         runValidTokenTest(token, { audience: 'MyAPI1', issuer: 'MyIssuer', revokedTokenIDs: [ 'id-456', 'id-789' ] });
      });

   });

});
