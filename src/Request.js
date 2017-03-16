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

   getEvent: function() {
      return this._event;
   },

   getContext: function() {
      return this._context;
   },

   validateQueryParams: function(rules) {
      var invalidRequiredFields = [],
          isValid = true,
          msg;

      _.each(rules, function(rule, name) {
         if (this.hasQueryParam(name) && rule.pattern && !rule.pattern.test(this.query(name))) {
            this._query[name] = undefined;
            isValid = false;
         }

         if (rule.required && (!this.hasQueryParam(name) || _.isEmpty(this.query(name)))) {
            isValid = false;
            invalidRequiredFields.push(name);
         }
      }.bind(this));

      if (!_.isEmpty(invalidRequiredFields)) {
         msg = 'Invalid required fields: ' + invalidRequiredFields.join(', ');
      }

      return { isValid: isValid, msg: msg };
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

   isBase64Encoded: function() {
      return !!this._event.isBase64Encoded;
   },

   header: function(k) {
      return this._headers[k];
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
