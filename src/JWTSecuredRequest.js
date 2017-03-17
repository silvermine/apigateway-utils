'use strict';

var _ = require('underscore'),
    jwt = require('jwt-simple'),
    Request = require('./Request'),
    BEARER_REGEX = /^Bearer /,
    INVALID_TOKEN_MSG = 'Invalid authorization token';

function invalidFieldResp(field) {
   return { isValid: false, msg: INVALID_TOKEN_MSG, err: 'Invalid "' + field + '" value' };
}

module.exports = Request.extend({

   init: function(evt, context) {
      this._super(evt, context);
      this._token = false;
   },

   getToken: function() {
      return this._token;
   },

   validateAuthorizationHeader: function(publicKey, validationUserOpts) {
      var rawHeader = this.header('Authorization') || '',
          rawToken = rawHeader.replace(BEARER_REGEX, ''),
          validationOpts = _.isObject(validationUserOpts) ? validationUserOpts : {},
          validation = { isValid: true },
          decoded = false;

      if (_.isEmpty(rawHeader) || _.isEmpty(rawToken)) {
         validation = { isValid: false, msg: 'No token supplied in Authorization header' };
      }

      if (validation.isValid && !BEARER_REGEX.test(rawHeader)) {
         validation = { isValid: false, msg: 'Authorization header not in correct format' };
      }

      if (validation.isValid) {
         try {
            decoded = jwt.decode(rawToken, publicKey, false, 'RS256');
         } catch(err) {
            validation = { isValid: false, msg: INVALID_TOKEN_MSG, err: err.message };
         }
      }

      validation = this._validateTokenAudience(decoded, validation, validationOpts.audience);
      validation = this._validateTokenIssuer(decoded, validation, validationOpts.issuer);
      validation = this._validateRevocationList(decoded, validation, validationOpts.revokedTokenIDs);

      if (validation.isValid) {
         this._token = decoded;
      } else {
         this._token = false;
      }

      return validation;
   },

   _validateTokenIssuer: function(token, validation, issuer) {
      if (validation.isValid === false || _.isEmpty(issuer)) {
         return validation;
      }

      return token.iss === issuer ? validation : invalidFieldResp('iss');
   },

   _validateTokenAudience: function(token, validation, intendedAudience) {
      if (validation.isValid === false || _.isEmpty(intendedAudience)) {
         return validation;
      }

      if (_.isArray(token.aud)) {
         return _.contains(token.aud, intendedAudience) ? validation : invalidFieldResp('aud');
      }

      // audience is a single value:
      return token.aud === intendedAudience ? validation : invalidFieldResp('aud');
   },

   _validateRevocationList: function(token, validation, revokedTokenIDs) {
      var revoked = { isValid: false, msg: INVALID_TOKEN_MSG, err: 'Token has been revoked' };

      if (validation.isValid === false || _.isEmpty(revokedTokenIDs)) {
         return validation;
      }

      return _.contains(revokedTokenIDs, token.jti) ? revoked : validation;
   },

});
