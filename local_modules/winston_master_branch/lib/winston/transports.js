/*
 * transports.js: Set of all transports Winston knows about
 *
 * (C) 2010 Charlie Robbins
 * MIT LICENCE
 *
 */

var path = require('path');

//
// Setup all transports as lazy-loaded getters.
//
Object.defineProperties(
  exports,
  ['Console', 'File', 'Http', 'Memory']
    .reduce(function (acc, name) {
      acc[name] = {
        configurable: true,
        enumerable: true,
        get: function () {

          // var fullpath = path.join(__dirname, 'transports', name.toLowerCase());
          // update: nexe compatibility.
          // var fullpath = './' + path.join('transports', name.toLowerCase() + '.js');
          // return require(fullpath)[name];
          switch (name.toLowerCase()) {
              case "transport": return require('./transports/transport.js')[name]; 
              case "console":   return require('./transports/console.js')[name]; 
              case "file":      return require('./transports/file.js')[name]; 
              case "http":      return require('./transports/http.js')[name]; 
              case "memory":    return require('./transports/memory.js')[name]; 
              default: throw new Error("[ERROR] transports: unexpected transport to include: " + name);
          }

        }
      };

      return acc;
    }, {})
);
