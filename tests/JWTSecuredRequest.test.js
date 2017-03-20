'use strict';

var _ = require('underscore'),
    fs = require('fs'),
    jwt = require('jwt-simple'),
    path = require('path'),
    expect = require('expect.js'),
    Request = require('../src/JWTSecuredRequest'),
    INVALID_TOKEN = { jti: 'invalidToken' },
    DEFAULT_MAKE_TOKEN_OPTS = { isValidSignature: true, isBeforeNBF: false, isAfterEXP: false };

describe('JWTSecuredRequest', function() {
   var publicKey = fs.readFileSync(path.join(__dirname, 'test-signing-key.pub')), // eslint-disable-line no-sync
       privateKey = fs.readFileSync(path.join(__dirname, 'test-signing-key')); // eslint-disable-line no-sync

   /**
    * Public service announcement: you should already know this, but just in case you do not:
    * the keys that are used in this test suite should never be used in your real code since
    * the private key is publicly-available.
    */

   describe('validateAuthorizationHeader', function() {
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

         obj = _.extend({}, tokenFields, obj);

         token = jwt.encode(obj, privateKey, 'RS256');

         if (!opts.isValidSignature) {
            token = reverseSignature(token);
         }

         return { string: token, obj: obj };
      }

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

      function runInvalidTokenTest(token, validationOpts) {
         var req = new Request({ headers: { Authorization: 'Bearer ' + token.string } }, {}),
             validation = runTest(req, validationOpts);

         expect(validation).to.be.an('object');
         expect(validation.isValid).to.be(false);
         expect(validation.msg).to.eql('Invalid authorization token');
         expect(validation.err).to.be.a('string');
         expect(req.getToken()).to.eql(false);
      }

      function runValidTokenTest(token, validationOpts) {
         var req = new Request({ headers: { Authorization: 'Bearer ' + token.string } }, {}),
             validation = runTest(req, validationOpts);

         expect(validation).to.be.an('object');
         expect(validation.isValid).to.be(true);
         expect(req.getToken()).to.eql(token.obj);
      }

      it('returns error and resets internal state when no header present', function() {
         var req = new Request({}, {}),
             validation = runTest(req);

         expect(validation).to.eql({ isValid: false, msg: 'No token supplied in Authorization header' });
         expect(req.getToken()).to.eql(false);
      });

      it('returns error and resets internal state when no header present', function() {
         var req = new Request({ headers: { Authorization: 'Bearer ' } }, {}),
             validation = runTest(req);

         expect(validation).to.eql({ isValid: false, msg: 'No token supplied in Authorization header' });
         expect(req.getToken()).to.eql(false);
      });

      it('returns error and resets internal state when header has no Bearer prefix', function() {
         var token = makeToken(),
             req = new Request({ headers: { Authorization: token.string } }, {}),
             validation = runTest(req);

         expect(validation).to.eql({ isValid: false, msg: 'Authorization header not in correct format' });
         expect(req.getToken()).to.eql(false);
      });

      it('returns error and resets internal state when now is before the "not before" in the token', function() {
         runInvalidTokenTest(makeToken({ isBeforeNBF: true }));
      });

      it('returns error and resets internal state when now is after the expiration in the token', function() {
         runInvalidTokenTest(makeToken({ isAfterEXP: true }));
      });

      it('returns error and resets internal state when token signature is incorrect', function() {
         runInvalidTokenTest(makeToken({ isValidSignature: false }));
      });

      it('returns error and resets internal state when audience is incorrect', function() {
         var token;

         token = makeToken({}, { aud: 'SomeOtherAPI' });
         runInvalidTokenTest(token, { audience: 'SomeExpectedAPI' });

         token = makeToken({}, { aud: [ 'SomeOtherAPI1', 'SomeOtherAPI2' ] });
         runInvalidTokenTest(token, { audience: 'SomeExpectedAPI' });
      });

      it('returns error and resets internal state when issuer does not match', function() {
         var token = makeToken({}, { iss: 'MyIssuer' });

         runInvalidTokenTest(token, { issuer: 'MyExpectedIssuer' });
      });

      it('returns error and resets internal state when token is revoked', function() {
         var token = makeToken({ isValidSignature: false });

         runInvalidTokenTest(token, { revokedTokenIDs: [ token.obj.jti ] });
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


   describe('_validateTokenAudience', function() {
      var req = new Request({}, {}),
          val = { isValid: true, msg: 'existing validation' },
          alreadyFailed = { isValid: false, msg: 'existing failed' },
          oneAudToken = { aud: 'SomeAPI' },
          multiAudToken = { aud: [ 'SomeAPI1', 'SomeAPI2' ] };

      it('returns the existing validation if no intended audience is supplied', function() {
         expect(req._validateTokenAudience(oneAudToken, val, undefined)).to.be(val);
         expect(req._validateTokenAudience(multiAudToken, val, undefined)).to.be(val);
         expect(req._validateTokenAudience(oneAudToken, val, '')).to.be(val);
         expect(req._validateTokenAudience(multiAudToken, val, '')).to.be(val);
         expect(req._validateTokenAudience(oneAudToken, val, null)).to.be(val);
         expect(req._validateTokenAudience(multiAudToken, val, null)).to.be(val);
         expect(req._validateTokenAudience(oneAudToken, val, false)).to.be(val);
         expect(req._validateTokenAudience(multiAudToken, val, false)).to.be(val);
         expect(req._validateTokenAudience(oneAudToken, val, [])).to.be(val);
         expect(req._validateTokenAudience(multiAudToken, val, [])).to.be(val);
      });

      it('returns the existing validation if it has already failed', function() {
         expect(req._validateTokenAudience('some string', alreadyFailed, 'ExpectedAudience')).to.be(alreadyFailed);
         expect(req._validateTokenAudience('some string', alreadyFailed, undefined)).to.be(alreadyFailed);
         expect(req._validateTokenAudience(false, alreadyFailed, 'ExpectedAudience')).to.be(alreadyFailed);
         expect(req._validateTokenAudience(false, alreadyFailed, undefined)).to.be(alreadyFailed);
      });

      it('returns the existing validation if an audience is passed in and the token passes validation', function() {
         expect(req._validateTokenAudience(oneAudToken, val, 'SomeAPI')).to.be(val);
         expect(req._validateTokenAudience(multiAudToken, val, 'SomeAPI1')).to.be(val);
         expect(req._validateTokenAudience(multiAudToken, val, 'SomeAPI2')).to.be(val);
      });

      it('returns failed validation with proper error message if the intended audience is not in the token', function() {
         var fieldFailed;

         fieldFailed = {
            isValid: false,
            msg: 'Invalid authorization token',
            err: 'Invalid "aud" value',
         };

         expect(req._validateTokenAudience(oneAudToken, val, 'SomeAPI1')).to.eql(fieldFailed);
         expect(req._validateTokenAudience(multiAudToken, val, 'SomeAPI')).to.eql(fieldFailed);
         expect(req._validateTokenAudience(multiAudToken, val, 'SomeAPIFoo')).to.eql(fieldFailed);
      });

   });


   describe('_validateRevocationList', function() {
      var req = new Request({}, {}),
          val = { isValid: true, msg: 'existing validation' },
          alreadyFailed = { isValid: false, msg: 'existing failed' },
          fooToken = { jti: 'foo' },
          barToken = { jti: 'bar' };

      it('returns the existing validation if no revocation list is supplied', function() {
         expect(req._validateRevocationList(fooToken, val, undefined)).to.be(val);
         expect(req._validateRevocationList(fooToken, val, '')).to.be(val);
         expect(req._validateRevocationList(fooToken, val, null)).to.be(val);
         expect(req._validateRevocationList(fooToken, val, false)).to.be(val);
         expect(req._validateRevocationList(fooToken, val, [])).to.be(val);
      });

      it('returns the existing validation if it has already failed', function() {
         expect(req._validateTokenIssuer(fooToken, alreadyFailed, 'MyActualIssuer')).to.be(alreadyFailed);
         expect(req._validateTokenIssuer(fooToken, alreadyFailed, 'SomeOtherIssuer')).to.be(alreadyFailed);
         expect(req._validateTokenIssuer(fooToken, alreadyFailed, undefined)).to.be(alreadyFailed);
         expect(req._validateTokenIssuer(fooToken, alreadyFailed, null)).to.be(alreadyFailed);
         expect(req._validateTokenIssuer(fooToken, alreadyFailed, '')).to.be(alreadyFailed);
      });

      it('returns the existing validation if a revocation list is passed in and does not contain the token JTI', function() {
         expect(req._validateRevocationList(fooToken, val, [ 'revoked1', 'revoked2' ])).to.be(val);
         expect(req._validateRevocationList(barToken, val, [ 'revoked1', 'revoked2', 'foo' ])).to.be(val);
         expect(req._validateRevocationList(fooToken, val, [ 'revoked1', 'revoked2', 'bar' ])).to.be(val);
         expect(req._validateRevocationList(fooToken, val, [])).to.be(val);
      });

      it('returns failed validation with proper error message if the token is in the revocation list', function() {
         var fieldFailed;

         fieldFailed = {
            isValid: false,
            msg: 'Invalid authorization token',
            err: 'Token has been revoked',
         };

         expect(req._validateRevocationList(fooToken, val, [ 'revoked1', 'revoked2', 'foo' ])).to.eql(fieldFailed);
         expect(req._validateRevocationList(barToken, val, [ 'revoked1', 'revoked2', 'bar' ])).to.eql(fieldFailed);
         expect(req._validateRevocationList(fooToken, val, [ 'revoked1', 'revoked2', 'foo', 'bar' ])).to.eql(fieldFailed);
         expect(req._validateRevocationList(barToken, val, [ 'revoked1', 'revoked2', 'foo', 'bar' ])).to.eql(fieldFailed);
      });

   });


   describe('_validateTokenIssuer', function() {
      var req = new Request({}, {}),
          val = { isValid: true, msg: 'existing validation' },
          alreadyFailed = { isValid: false, msg: 'existing failed' },
          token = { iss: 'MyActualIssuer' };

      it('returns the existing validation if no intended issuer is supplied', function() {
         expect(req._validateTokenIssuer(token, val, undefined)).to.be(val);
         expect(req._validateTokenIssuer(token, val, '')).to.be(val);
         expect(req._validateTokenIssuer(token, val, null)).to.be(val);
         expect(req._validateTokenIssuer(token, val, false)).to.be(val);
         expect(req._validateTokenIssuer(token, val, [])).to.be(val);
      });

      it('returns the existing validation if it has already failed', function() {
         expect(req._validateTokenIssuer(token, alreadyFailed, 'MyActualIssuer')).to.be(alreadyFailed);
         expect(req._validateTokenIssuer(token, alreadyFailed, 'SomeOtherIssuer')).to.be(alreadyFailed);
         expect(req._validateTokenIssuer(token, alreadyFailed, undefined)).to.be(alreadyFailed);
         expect(req._validateTokenIssuer(token, alreadyFailed, null)).to.be(alreadyFailed);
         expect(req._validateTokenIssuer(token, alreadyFailed, '')).to.be(alreadyFailed);
      });

      it('returns the existing validation if an issuer is passed in and the token contains that isser', function() {
         expect(req._validateTokenIssuer(token, val, 'MyActualIssuer')).to.be(val);
      });

      it('returns failed validation with proper error message if the intended issuer is not in the token', function() {
         expect(req._validateTokenIssuer(token, val, 'SomeOtherIssuer')).to.eql({
            isValid: false,
            msg: 'Invalid authorization token',
            err: 'Invalid "iss" value',
         });
      });

   });

});
