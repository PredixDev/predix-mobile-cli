### Nexe

[![Join the chat at https://gitter.im/crcn/nexe](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/crcn/nexe?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge) [![Dependency Status](https://david-dm.org/crcn/nexe.svg)](https://david-dm.org/crcn/nexe)
[![Stories in Ready](https://badge.waffle.io/crcn/nexe.svg?label=ready&title=Ready)](http://waffle.io/crcn/nexe)

# NOTICE: Node 5.x.x is broken right now.

Nexe is a command-line utility that compiles your Node.js application into a single executable file.

![screen shot 2014-02-28 at 10 32 54 am](https://f.cloud.github.com/assets/757408/2296993/c276f7b6-a0a6-11e3-86d3-e6c5feba2a85.png)


### Motivation

- Ability to run multiple applications with *different* node.js runtimes.
- Distributable binaries without needing node / npm.
- Starts faster.
- Lockdown specific application versions, and easily rollback.
- Faster deployments.

## Building Requirements

- Linux / Mac / BSD / Windows
- Python 2.6 or 2.7 (use --python if not in PATH)
- Windows: Visual Studio 2010+

## Caveats

### Doesn't support native modules

- Use the techniques below for working around dynamic require statements to exclude the module from the bundling, and deploy along side the executable in a node_module folder so your app can find it. Note: On windows you may need to have your app be named node.exe if .node file depends on node.

### Doesn't support dynamic require statements

Such As:

```javascript
var x = require(someVar);
```

In this case nexe won't bundle the file

```javascript
	var x;
	if (someCheck) {
		x = require("./ver1.js");
	} else {
		x = require("./var2.js");
	}
```

In this case nexe will bundle both files.

Workarounds:
1) for dynamic requires that you want bundled add the following into your project

```javascript
	var dummyToForceIncludeForBundle = false;
	if (dummyToForceIncludeForBundle) {
		require("./loadedDynamicallyLater.js");
		// ...
	}
```
this will trick the bundler into including them.

2) for dynamic files getting included that you don't want to be

```javascript
	var moduleName = "./ver2.js";
	if (someCheck) {
		moduleName = "./ver1.js";
	}
	var x = require(moduleName);
```
Note: neither file will be bundled.

Using these two techniques you can change your application code so modules are not bundles, and generate a includes.js file as part of your build process so that the right files get bundled for your build configuration.

### &#95;&#95;dirname

Once the module is bundled it is part of the executable. &#95;&#95;dirname is therefore the executable dir (process.execPath). Thus if you put resources on a relative path from the the executable your app will be able to access them.

If you had a data file at `/dev/myNodeApp/stateManager/handler/data/some.csv`
and a file at `/dev/myNodeApp/stateManager/handler/loader.js`

```javascript
	module.exports = fw.readFileSync(path.join(__dirname, "./data/some.csv"));
```
You would need to deploy some.csv in a sub dir `data/` along side your executable

There are potential use cases for &#95;&#95;dirname where the executable path is not the correct substitution, and could result in a silent error (possibly even in a dependency that you are unaware of).

Note: &#95;&#95;filename will be 'undefined'

### child_process.fork

child_process.spawn works is unmodified, but child_process.fork will make an attempt to launch a new instance of your executable and run the bundled module.

## Installation

Via NPM:

```bash
	npm install nexe [-g]
```

Or git:

```bash
	git clone https://github.com/crcn/nexe.git
```

### CLI Usage

```text

Usage: nexe -i [sources] -o [binary] [options]

Options:
	-i, --input    The entry javascript files         [default: cwd]
	-o, --output   The output binary                  [default: out.nex]
	-r, --runtime  The node.js runtime to use         [default: "latest"]
	-t, --temp     The path to store node.js sources  [default: ./tmp/nexe]
	-f, --flags    Don't parse node and v8 flags, pass through app flags  [default: false]
	-v, --version  Display version number
	-p, --python   Set path of python to use.         [default: "python"]
	-F, --framework Set the framework to use.          [default: "nodejs"]

```


### Code Usage

```javascript

var nexe = require('nexe');

nexe.compile({
	input: 'input.js',
	output: 'path/to/bin',
	nodeVersion: '0.12.5',
	nodeTempDir: 'src',
	python: 'path/to/python',
	resourceFiles: [ 'path/to/a/file' ],
	flags: true,
	framework: "nodejs"
}, function(err) {
	console.log(err);
});

```

### package.json inclusion

As of 0.4.0 you can now embed nexe options into package.json. Note that this Format
is still in works, so it is likely to change.

```
"nexe": {
	"input": "./bin/nexe",
	"output": "nexe^$",
	"temp": "src",
	"runtime": {
		"framework": "iojs",
		"version": "2.3.1",
		"ignoreFlags": true
	}
}
```

Notes:

* output: can use ^$ for platform specific file extension

## Maintainers

* __Jared Allard__ ([@jaredallard](https://github.com/jaredallard)) &lt;[jaredallard@outlook.com](mailto:jaredallard@outlook.com)&gt; (Active)
* __Christopher Karper__ ([@ckarper](https://github.com/CKarper)) &lt;[Christopher.Karper@gmail.com](mailto:Christopher.Karper@gmail.com)&gt; (Active)
* __Craig Jefferds__ ([@crcn](https://github.com/crcn)) &lt;[craig.j.condon@gmail.com](mailto:craig.j.condon@gmail.com)&gt; (Not Active)
