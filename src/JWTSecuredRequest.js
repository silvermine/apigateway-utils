'use strict';

var _ = require('underscore'),
    Request = require('./Request'),
    JWTValidator = require('./JWTValidator');

module.exports = Request.extend({

   init: function(evt, context, opts) {
      this._super(evt, context, opts);
      this._token = false;
   },

   getToken: function() {
      return this._token;
   },

   validateAuthorizationHeader: function(publicKey, validationUserOpts) {
      var validationOpts = _.isObject(validationUserOpts) ? validationUserOpts : {},
          validator = new JWTValidator(publicKey),
          validation;

      validation = validator
         .issuer(validationOpts.issuer)
         .audience(validationOpts.audience)
         .revocation(validationOpts.revokedTokenIDs)
         .validate(this.header('Authorization'), true, 'Authorization');

      if (_.isEmpty(validation.errors)) {
         this._token = validation.token;
      } else {
         this._token = false;
      }

      return validation;
   },

});
