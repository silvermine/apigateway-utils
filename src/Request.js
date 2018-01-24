'use strict';

var _ = require('underscore'),
    Class = require('class.extend');

module.exports = Class.extend({

   init: function(evt, context) {
      this._started = new Date().getTime();
      this._event = evt;
      this._context = context;
      this._query = this._event.queryStringParameters || {};
      this._pathParams = this._event.pathParameters || {};
      this._headers = this._event.headers || {};
   },

   _parseBody: function() {
      if (this.header('Content-Type') === 'application/json') {
         try {
            return JSON.parse(this._event.body);
         } catch(err) {
            return null;
         }
      }

      return null;
   },

   getEvent: function() {
      return this._event;
   },

   getContext: function() {
      return this._context;
   },

   validateQueryParams: function(rules) {
      var invalidFields = [];

      _.each(rules, function(rule, name) {
         var isValid = true,
             has = this.hasQueryParam(name),
             val = this.query(name),
             asNumber = Number(val);

         if (has && !_.isUndefined(rule.pattern) && !rule.pattern.test(val)) {
            this._query[name] = undefined;
            isValid = false;
         }

         if (has && !_.isUndefined(rule.min) && (_.isNaN(asNumber) || asNumber < rule.min)) {
            this._query[name] = undefined;
            isValid = false;
         }

         if (has && !_.isUndefined(rule.max) && (_.isNaN(asNumber) || asNumber > rule.max)) {
            this._query[name] = undefined;
            isValid = false;
         }

         if (rule.required && (!this.hasQueryParam(name) || _.isEmpty(this.query(name)))) {
            isValid = false;
         }

         if (isValid === false) {
            invalidFields.push(name);
         }
      }.bind(this));

      if (!_.isEmpty(invalidFields)) {
         return { isValid: false, msg: 'Invalid fields: ' + invalidFields.join(', ') };
      }

      return { isValid: true };
   },

   hasPathParam: function(k) {
      return !_.isUndefined(this.pathParam(k));
   },

   pathParam: function(k) {
      return this._pathParams[k];
   },

   hasQueryParam: function(k) {
      return !_.isUndefined(this.query(k));
   },

   query: function(k) {
      return this._query[k];
   },

   context: function(k) {
      return this._context[k];
   },

   body: function() {
      return this._event.body;
   },

   parsedBody: function() {
      if (_.isUndefined(this._parsedBody)) {
         this._parsedBody = this._parseBody();
      }

      return this._parsedBody;
   },

   isBase64Encoded: function() {
      return !!this._event.isBase64Encoded;
   },

   header: function(k) {
      var userKey = (k || '').toLowerCase();

      return _.find(this._headers, function(val, key) {
         return key.toLowerCase() === userKey;
      });
   },

   path: function() {
      return this._event.path;
   },

   method: function() {
      return this._event.httpMethod;
   },

   started: function() {
      return this._started;
   },

});
