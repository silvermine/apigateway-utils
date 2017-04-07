'use strict';

module.exports = function(grunt) {

   var config;

   config = {
      js: {
         all: [ 'Gruntfile.js', '**/*.js', '!**/node_modules/**/*', '!**/coverage/**/*' ],
      },
   };

   grunt.initConfig({

      pkg: grunt.file.readJSON('package.json'),

      eslint: {
         target: config.js.all,
      },

   });

   grunt.loadNpmTasks('grunt-eslint');

   grunt.registerTask('standards', [ 'eslint' ]);
   grunt.registerTask('default', [ 'standards' ]);

};
