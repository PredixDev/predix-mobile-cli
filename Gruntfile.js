module.exports = function(grunt) {
  "use strict";

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    clean: {
      coverage: {
        src: ['test/unit/coverage/']
      }
    },

    mocha_istanbul: {
      coverage: {
          src: 'test/unit', // a folder works nicely
          options: {
              mask: '**/*-spec.js',
              coverageFolder: 'test/unit/coverage'
          }
      }
    },
    istanbul_check_coverage: {
      default: {
        options: {
          coverageFolder: 'test/unit/coverage', // will check both coverage folders and merge the coverage results
          check: {
            lines: 80,
            statements: 80
          }
        }
      }
    },

    jshint: {
      files: [
          '*.js'
        , 'js/**/*.js'
        , 'lib/**/*.js'
      ] 
      , options: {
          jshintrc: '.jshintrc'
        , verbose: true
        , reporter: require('jshint-stylish')
        , globals: {
            "jQuery": true
          , "Promise": true
        }
      }
    },
    watch: {
      files: ['<%= jshint.files %>'],
      tasks: ['jshint']
    }

  });

  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-mocha-istanbul');
  grunt.loadNpmTasks("grunt-contrib-jshint");
  grunt.loadNpmTasks('grunt-contrib-watch');

  grunt.registerTask('test', ['clean:coverage', 'mocha_istanbul:coverage']);
  grunt.registerTask('default', ['jshint']);
};


