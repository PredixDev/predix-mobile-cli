'use strict';

var Promise = require('bluebird');
var fs = require('fs');
var archiver = require('archiver');
var path = require('path');

/**
 * Given a set of folders and files, create a zip file which includes those files, with the relative roots removed from the file paths stored in the zip.  
 */
function SimpleZip(fileEntries, zipFilePath) {
  
  if (!fileEntries) throw new Error("required parameter: fileEntries");
  if (!zipFilePath) throw new Error("required parameter: zipFilePath");
  
  zipFilePath = path.resolve(process.cwd(), zipFilePath);
  
  if (typeof(fileEntries) === 'string') {
    throw new Error("unexpected `fileEntries` parameter format.  Expected: [{root: 'path', files: ['path']}]");
  }
  
  var archive = archiver('zip');
  
  return new Promise(function (resolve, reject) {
      archive.on('error', reject);
      
      Promise.map(
            fileEntries
          , ProcessFileEntry
          , {concurrency: 1}
      )
      .then(
          FinalizeZip
        , function () {
            archive.abort();
        }
      )
      .then(resolve, reject)
      
      function FinalizeZip() {
          return new Promise(function (resolve, reject) {
              fs.stat(zipFilePath, function (err, stats) {
                  if (err && (err.code !== 'ENOENT')) {
                      reject(err);
                      return;
                  }
                  
                  var writeSteam = fs.createWriteStream(zipFilePath);
                  writeSteam.on('error', function (err) {
                      reject(err);
                  });
                  
                  writeSteam.on('close', function () {
                      resolve(zipFilePath);
                  });
                  
                  archive.pipe(writeSteam);
                  
                  archive.finalize();
              });
          });
      }
      
      function ProcessFileEntry(fileEntry) {
          
          var zipExcludeRoot = path.resolve(process.cwd(), fileEntry.root.valueOf());
          var pathList = fileEntry.files.valueOf();
          
          return Promise.map(
                pathList 
              , ProcessFilePath
              , {concurrency: 1}
          );
          
          function ProcessFilePath(filePath) {
            
              filePath = path.resolve(zipExcludeRoot, filePath);
            
              return new Promise(function (resolve, reject) {
                  return fs.stat(filePath, function (err, stats) {                
                      if (err) {
                          reject(err);
                          return;
                      }
                      
                      if (stats.isDirectory()) {
                          archive.directory(filePath, false);
                          
                      } else {
                          var contentFilePath = filePath;
                           
                          if (contentFilePath.indexOf(zipExcludeRoot) !== 0) {
                            reject("[ERROR] file path not found under specified exclude root; filePath: " + filePath + "; root: " + zipExcludeRoot);
                            return;
                          }
                          
                          contentFilePath = contentFilePath.substr(zipExcludeRoot.length);
                          if (contentFilePath.indexOf("/") === 0) contentFilePath = contentFilePath.substr(1);
                          
                          archive.file(filePath, {
                              name: contentFilePath // path.basename(filePath)
                          });
                          
                      }
                      
                      resolve();
                  });
              });
          }
          
      }
  });

}

module.exports = SimpleZip;
