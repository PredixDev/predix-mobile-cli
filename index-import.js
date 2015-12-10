#!/usr/bin/env node

var program = require('commander-lm');
require('./lib/pm-utils/Strings');

function stringStartsWith(string, prefix) {
  return string.slice(0, prefix.length) == prefix;
};

module.exports = function() {

var nanoImport = function(dataToImport){
  var UAAConfig = require("./lib/cf-api/UAA-Auth.js").UAAConfig.valueOf();
  var PM_API = new (require("./lib/pm-api/PM-API.js"))();
  var PM_Nano = require("./lib/pm-nano/PM-Nano.js");
  var UserState = require("./lib/UserState.js");
  var uaaConfig = new UAAConfig(UserState);
  var authHeaders = uaaConfig.GetSessionHeaders();
  var admin_data_endpoint = UserState.target.config.admin_data_endpoint.valueOf();
  var url = require('url');
  var server_url = url.resolve(UserState.target.api, admin_data_endpoint);
  var pmNano = new PM_Nano(server_url, 'pm', authHeaders);
  var repository = pmNano.GetNanoRepository();
  var docs = {"docs":dataToImport}
  repository._db.bulk(docs,{},function(err,body){ if(err) console.log(err); else console.log(body); });
};

var importData = function (dataToImport) {
  var data = require(dataToImport);
  var toImport =  Array.isArray(data) ? data : data.rows.filter(function(eachDoc){return eachDoc.doc.dataType && eachDoc.doc.dataType.startsWith('entity');}).map(function(eachDoc){ var transformed = eachDoc.doc; delete transformed['_rev']; return transformed;});
  console.log('Found ' + toImport.length + ' records to import.');
  nanoImport(toImport);
};

return  {
  importData: importData,
    initializeDB: function (dataToImport, afterInit) {
      console.log('Importing data.');
      importData(dataToImport);
    },
  }
}

// parse input:
program
    .usage('[path/to/initial/data.json] *the initial/data.json is optional. It will use Sample data as a default.')
    .option('--debug', 'Set logging level to debug (more traces than "verbose")')
    .option('--verbose', 'Set logging level to verbose.')
    .parse(process.argv);

var initialData = typeof program.args[0] == "undefined" ? "./lib/data.json": program.args[0];
console.log('importing using data [' + initialData + ']');
module.exports().initializeDB(initialData);
