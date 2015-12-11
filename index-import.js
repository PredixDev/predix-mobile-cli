#!/usr/bin/env node

require('./lib/pm-utils/Strings');
var program = require('commander-lm');
var repository;

function getRepository() {
  if(repository) return repository;

  var UAAConfig = require("./lib/cf-api/UAA-Auth.js").UAAConfig.valueOf();
  var PM_Nano = require("./lib/pm-nano/PM-Nano.js");
  var UserState = require("./lib/UserState.js");
  var uaaConfig = new UAAConfig(UserState);
  var authHeaders = uaaConfig.GetSessionHeaders();
  var admin_data_endpoint = UserState.target.config.admin_data_endpoint.valueOf();
  var url = require('url');
  var server_url = url.resolve(UserState.target.api, admin_data_endpoint);
  var pmNano = new PM_Nano(server_url, 'pm', authHeaders);
  repository = pmNano.GetNanoRepository();
  return repository;
}

module.exports = function() {

var nanoImport = function(dataToImport){
  var docs = {"docs":dataToImport}
  getRepository()._db.bulk(docs,{},function(err, body){ if(err) console.log(err); else console.log(body); });
};

var importData = function (dataToImport, channels) {
  var data = JSON.parse(require('fs').readFileSync(dataToImport, 'utf8'))
  //var data = require(dataToImport);
  var toImport =  Array.isArray(data) ? data : data.rows.filter(function(eachDoc){return eachDoc.doc.dataType && eachDoc.doc.dataType.startsWith('entity');}).map(function(eachDoc){ var transformed = eachDoc.doc; delete transformed['_rev']; return transformed;});
  if(channels) {
    toImport.forEach(function(each){ if(each.channels) {each.channels.push(channels); each.channels = [].concat.apply([],each.channels);} })
  }
  console.log('Found ' + toImport.length + ' records to import.');
  nanoImport(toImport);
};

return  {
  importData: importData,
    initializeDB: function (dataToImport, channels) {
      console.log('Importing data.');
      importData(dataToImport, channels);
    },
  }
}

function getPMAppFromJson(appJsonFileName) {
  var app = require(appJsonFileName);
  var webapp = 'webapp-' + app.starter + '_' + app.dependencies[app.starter].replace(/\./g, '_')
  return getRepository().findByIdAsync(webapp);
}

function doImport(channels) {
  console.log('importing using data [' + initialData + ']');
  module.exports().initializeDB(initialData, channels);
}

var initialData;
var pmAppPromise;
// parse input:
program
    .usage('[path/to/initial/data.json] *the initial/data.json is optional. It will use Sample data as a default.')
    .option('-D, --debug', 'Set logging level to debug (more traces than "verbose")')
    .option('-v, --verbose', 'Set logging level to verbose.')
    .option('-d, --data [value]', 'Specifies the data.json file to import.')
    .option('-a, --app [value]', 'Specifies the app.json file to consider. It is read to determine the channel for imported docs')
    .parse(process.argv);

initialData = program.data;
if (! initialData) initialData = typeof program.args[0] == "undefined" ? "./lib/data.json" : program.args[0];
initialData = initialData.startsWith('/') ? initialData : process.cwd() + '/' + initialData;

if(program.app) pmAppPromise = getPMAppFromJson(program.app);
else pmAppPromise = program.args[1] ? getPMAppFromJson(program.args[1]) : undefined;

if (pmAppPromise) {
  pmAppPromise.then(function (pmApp) {
    var channels = pmApp.channels;
    doImport(channels)
  });
}
else doImport();
