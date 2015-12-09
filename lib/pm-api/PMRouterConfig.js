
'use strict';

var BPromise = require('bluebird'); BPromise.longStackTraces();

var CONFIG_DOCUMENT_ID = 'router-configuration-1';
var DEFAULT_CONFIG_EMPTY = {
	"COMMAND_PROCESSORS": [
		// {"service-name": "processor1", "credentials": {"url": "http://localhost:8086/"}}
	],
	"SERVICE_MAPPING": [
		// {"uri": "^/service1/.*", "service-name": "processor1"}
	]
};

function PMRouterConfig(logger, repository) {
        
        var _last_config_document;
        var documentID = CONFIG_DOCUMENT_ID;
        
        function GetConfig() {
                if (_last_config_document) {
                        return BPromise.resolve(_last_config_document);
                }
                
                logger.debug("Retrieving configuration document:", documentID);
                
                return repository.findByIdAsync(documentID)
                .catch(function (status) {
                        var statusCode = status.statusCode;
                        if (statusCode === 404) {
                                console.log("[INFO] PMRouterConfig: config document not found in server:", documentID, "; using default empty document.");
                                var document = JSON.parse(JSON.stringify(DEFAULT_CONFIG_EMPTY));
                                document._id = documentID;
                                return document;
                        // } else {
                        //         logger.error("[ERROR] Error in retrieving configuration document from server:", "detail:", status);
                        }
                        return BPromise.reject(status);
                })
                .then(function (document) {
                        _last_config_document = document;
                        
                        logger.silly("Document content:", document);
                        
                        return document;
                });
        }
        
        function AddService(serviceName, serviceURL) {
                
                logger.debug("Adding service entry:", serviceURL);
                
                if (serviceURL.indexOf(":/") === -1 ) {
                        serviceURL = "https://" + serviceURL;
                }
                
                var commandProcessors = _last_config_document.COMMAND_PROCESSORS.valueOf();
                // {"service-name": "processor1", "credentials": {"url": "http://localhost:8086/"}}
                
                for (var i = commandProcessors.length - 1; i > -1; i--) {
                        var item = commandProcessors[i];
                        if (item['service-name'] === serviceName) {
                                commandProcessors.splice(i, 1);
                        }
                }
                
                commandProcessors.push({"service-name": serviceName, "credentials": {"url": serviceURL}});
                
        }
        
        function FixRoutePattern(routePattern) {
                
                if (routePattern.indexOf("^") !== 0) {
                        routePattern = "^" + routePattern;
                }
                
                return routePattern;
        }
        
        function RemoveRoute(routePattern) {
                
                logger.debug("Removing route entry:", routePattern);
                
                routePattern = FixRoutePattern(routePattern);
                
                var serviceMapping = _last_config_document.SERVICE_MAPPING.valueOf();
                // {"uri": "^/service1/.*", "service-name": "processor1"}
                
                var didRemoveAny = false;
                for (var i = serviceMapping.length - 1; i > -1; i--) {
                        var item = serviceMapping[i];
                        if (
                                (item['uri'] === routePattern)
                        ) {
                                serviceMapping.splice(i, 1);
                                
                                didRemoveAny = true;
                        }
                }
                
                return didRemoveAny;
        }
        
        function AddCommandRoute(serviceName, routePattern) {
                
                logger.debug("Adding route entry:", routePattern);
                
                routePattern = FixRoutePattern(routePattern);
                
                var serviceMapping = _last_config_document.SERVICE_MAPPING.valueOf();
                // {"uri": "^/service1/.*", "service-name": "processor1"}
                
                for (var i = serviceMapping.length - 1; i > -1; i--) {
                        var item = serviceMapping[i];
                        if (
                                   (item['service-name'] === serviceName) 
                                && (item['uri'] === routePattern)
                        ) {
                                serviceMapping.splice(i, 1);
                        }
                }
                
                serviceMapping.push({"uri": routePattern, "service-name": serviceName});
                
        }
        
        function SetConfig(document) {
                
                logger.debug("Persisting configuration to server.");
                
                if (document) {
                        _last_config_document = document;
                } else {
                        document = _last_config_document;
                }
                
                logger.silly("Persisting document:", document);
                
                return repository.saveOverAsync(document);
        }
        
        // exports:
        this.GetConfig = GetConfig;
        this.SetConfig = SetConfig;
        this.AddService = AddService;
        this.AddCommandRoute = AddCommandRoute;
        this.RemoveRoute = RemoveRoute;
        
}

module.exports = PMRouterConfig;

