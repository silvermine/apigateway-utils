'use strict';

var _ = require('underscore'),
    Class = require('class.extend'),
    DEFAULT_OPTS;

DEFAULT_OPTS = {
   logRequest: true,
};

module.exports = Class.extend({

   init: function(evt, context, opts) {
      this._started = new Date().getTime();
      this._event = evt;
      this._context = context;
      this._query = this._event.queryStringParameters || {};
      this._pathParams = this._event.pathParameters || {};
      this._headers = this._event.headers || {};
      this._opts = _.extend({}, DEFAULT_OPTS, opts);

      if (this._opts.logRequest) {
         this.logRequest(_.extend({
            event: 'api-request',
            path: evt.path,
            queryParams: this._query,
         }, this._opts.additionalRequestLoggingData));
      }
   },

   logRequest: function(reqObj) {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(reqObj));
   },

   _parseBody: function(throwError) {
      // By default we just squash any errors while parsing the body, but if the user
      // wants an error to be thrown, they can pass a flag to indicate this.
      if (this.header('Content-Type') === 'application/json') {
         try {
            return JSON.parse(this._event.body);
         } catch(err) {
            if (throwError) {
               throw err;
            }
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

   renamePathParam: function(from, to) {
      // This is helpful in a scenario where you have two different types of operations
      // that use a path param at the same location in the URL, so APIGW only allows you
      // to use a single name for the param, but in the code it would make more sense if
      // the param were named something different.
      this._pathParams[to] = this._pathParams[from];
      delete this._pathParams[from];
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

   parsedBody: function(throwError) {
      if (_.isUndefined(this._parsedBody)) {
         this._parsedBody = this._parseBody(throwError);
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
