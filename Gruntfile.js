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

    , execute: {
      "build-exe": {
            target: {
                src: ['build-executable.js']
            }
        }
    }
    , copy: {
        "copy-uaa": {
            files: [
                // includes files within path and its sub-directories 
                {expand: true, src: ['/uaa-scripts/**'], dest: 'bin-release/uaa-scripts'}
            ],
        }
    }
    , compress: {
        "release-archive": {
            options: {
                archive: function () {
                  var version = require('./package.json').version;

                    var fileName = 'pm'
                    fileName += '-v' + version;

                    var platform = require('os').platform();
                    if (platform.indexOf("win") === 0) {                    
                        fileName += '-' + 'win';

                    } else if (platform.indexOf("darwin") === 0) {
                      fileName += '-' + 'darwin64';

                    } else {
                      fileName += '-' + 'linux';

                    }

                    return 'bin-release-zip/' + fileName + '.zip';
                }
            },
            files: [
                {src: ['bin-release/*'], dest: '/'}
            ]
        }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-mocha-istanbul');
  grunt.loadNpmTasks("grunt-contrib-jshint");
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-execute');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-compress');

  grunt.registerTask('test', ['clean:coverage', 'mocha_istanbul:coverage']);

  grunt.registerTask('build', ['execute:build-exe', 'copy:copy-uaa', 'copy:copy-uaa', 'compress:release-archive']);
  grunt.registerTask('default', ['jshint']);
};


