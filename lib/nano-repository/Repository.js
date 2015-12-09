"use strict";

var fs = require('fs');
var crypto = require('crypto');

var Repository = function(db, logger) {
  this._db = db;
  this._logger = logger || console;

  if (!this._db) {
    throw new Error('Please pass a collection into your repository.');
  }
};

Repository.prototype.updateViews = function(viewDoc, callback) {
    callback = callback || function(){};

    var designDocID = viewDoc._id.valueOf();
    delete viewDoc._id;
    var collection = designDocID.split("/").pop();

    var contents = JSON.stringify(viewDoc);

    // calculate the md5 hash of the view definitions - if they haven't changed
    // then we don't need to update them..
    var md5sum = crypto.createHash("md5");
    md5sum.update(contents);
    var hash = md5sum.digest("hex");

    var data = JSON.parse(contents);
    data.hash = hash;

    // create view methods
    Object.keys(data.views.valueOf())
    .forEach(function(viewName) {
      var methodName = "find" + viewName.substr(0, 1).toUpperCase() + viewName.substr(1);

      this._logger.info("Repository", "Creating", methodName, "method for collection", collection);

      this[methodName] = function() {
        var callback = arguments[arguments.length - 1];

        if(!callback || !(callback instanceof Function)) {
          throw new Error("Please specify a callback function to receive the result of " + methodName);
        }

        var args = [collection, viewName];

        if(arguments.length > 1) {
          var parameters = {
            keys: []
          };

          for(var i = 0; i < arguments.length - 1; i++) {
            parameters.keys.push(arguments[i]);
          }

          args.push(parameters);
        }

        args.push(function(error, result) {
          if(error) {
            this._logger.error(error);

            result = {rows: []};
          }

          var output = [];

          result.rows.forEach(function(row) {
            output.push(row.value);
          })

          callback(error, output);
        }.bind(this));

        this._db.view.apply(this._db, args);
      }.bind(this);
    }.bind(this));

    // update views if necessary
    this._db.get("_design/" + collection, function(error, result) {
      if(error && (error.statusCode !== 404)) {
        return callback(error);
      }

      if(result) {

        // !!! Sync-Gateway does not preserve arbitrary properties for submitted design documents;  We re-calculate the hash here.
        if (!result.hash) {
            // var contents = JSON.stringify(result); // temp commented, the response function from the PUT is not the same as what was sent;  We need to submit the has as part of the method, and compare the hash, rather than hashing the strings.
            var md5sum = crypto.createHash("md5");
            md5sum.update(contents);
            var hash = md5sum.digest("hex");
            result.hash = hash;
        }

        var isDesignSame = result.hash === data.hash;

        // !!! sync-gateway 1.1.0 temporary resolution.
        if (result.error && result.reason) {
          isDesignSame = true;
        }

        if(isDesignSame) {
          this._logger.info("Repository", "No view update required for collection", collection);

          return callback();
        } else {
          this._logger.info("Repository", "View definitions have changed - will update collection", collection);
        }

        data._rev = result._rev;
      }

      this._db.insert(data, "_design/" + collection, callback);
    }.bind(this));
};

Repository.prototype.findById = function(id, callback) {
  this._db.get(id, function(error, result) {
    callback(error, result);
  });
};

Repository.prototype.save = function(document, callback) {
  if(!document.created_at) {
    document.created_at = Date.now();
  } else {
    document.updated_at = Date.now();
  }

  this._db.insert(document, function(error, result) {
    if(!error) {
      document._id = result.id;
      document._rev = result.rev;
    }

    callback(error, result);
  });
};

/**
Perform save operation, updating the _rev field of the input document and re-trying as needed, until the PUT is successful.
*/
Repository.prototype.saveOver = function(document, callback) {
    var _this = this;
    return _this.save(document, function(error, result) {
        if (error) {
            if (error.statusCode === 409) {
                _this._db.head(document._id, function (headError, headResult, headHeaders) {
                    if (headError) {
                        callback(headError, headResult);
                        return;
                    }
                    document._rev = headHeaders.etag.valueOf().replace(/["]/g, "");
                    _this.saveOver(document, callback);
                });
                return;
            }
        }

        callback(error, result);
    });
};

Repository.prototype.RetryUntilNot409 = function(document_id, fn_invokeWithDocument, callback) {
    var _this = this;
    return _this.findById(document_id, _FindByIDHandler);
    
    function _FindByIDHandler(error, result) {
        if (error) {
            callback(error, null);
            return;
        }
        
        return fn_invokeWithDocument(result)
        .then(function (result) {
            callback(null, result);
        }, function (error) {
            if (error.statusCode.valueOf() === 409) {
                return _this.findById(document_id, _FindByIDHandler);
            }
        });
        
    }
};

Repository.prototype.remove = function(document, callback) {
  if(!document) {
    return callback(new Error('Document to remove was invalid!'));
  }

  if(!document._id) {
    return callback(new Error('Document to remove had no id!'));
  }

  if(!document._rev) {
    return callback(new Error('Document to remove had no revision!'));
  }

  this._db.destroy(document._id, document._rev, callback);
};

Repository.prototype.addAttachment = function(document, name, file, mimeType, callback) {
  if(arguments.length === 4) {
    return this._streamAttachment.apply(this, arguments);
  }

  fs.readFile(file, function(error, data) {
    if(error) {
      return callback(error);
    }

    this._db.attachment.insert(document._id, name, data, mimeType, {
      rev: document.rev ? document.rev : document._rev
    }, function(error, body) {
      if(!error) {
        document._rev = body.rev;
      }

      callback(error, body)
    });
  }.bind(this));
};

Repository.prototype._streamAttachment = function(document, name, mimeType, callback) {
  return this._db.attachment.insert(document._id, name, null, mimeType, {
      rev: document._rev
    },
    function(error, body) {
      if(!error) {
        document._rev = body.rev;
      }

      callback(error, body)
    }
  );
};

Repository.prototype.findAttachment = function(document, name, callback) {
  this._db.attachment.get(document._id, name, function(error, body) {
    callback(error, body);
  });
};

Repository.prototype.streamAttachmentTo = function(document, name, pipe) {
  this._db.attachment.get(document._id, name).pipe(pipe);
};

// exports
module.exports = Repository;
