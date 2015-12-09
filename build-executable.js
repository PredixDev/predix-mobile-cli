#!/usr/bin/env node

'use strict';

var nexe = require('nexe');
var os = require('os');

var platform = os.platform();

var outputName = "pm";
if (platform.indexOf("win") === 0) outputName += ".exe";

var outputPath = "bin-release/" + outputName;

nexe.compile({
    input: 'index.js',
    output: outputPath,
    nodeVersion: '0.12.8',
    nodeTempDir: 'bin-temp',
    flags: true,
    python: "python",
    framework: 'nodejs'
}, function(err, result) {
	if (err) {
		console.log(err);
	} else {
		console.log("OK");
	}
});
