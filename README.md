# PM-CLI Utility (v1.0.2)

Utility for working with PM service.


## Installation

Checkout this repository, open the folder in a terminal window, and execute:

```
npm install
```

Then register the `pm` application globally on the local system, by executing:

```
npm link
```

After `npm link` completes, execute this command for command line parameter details:


```
pm --help
```

## Reference Manifests

- A reference `app.json` manifest file is located here: <br /> https://github.build.ge.com/predix-mobile/predixmobile-services/blob/develop/utilities/reference-data/pm-app-1/app.json

- A reference `webapp.json` manifest file is located in the reference web app at this location:  <br />  https://github.build.ge.com/predix-mobile/px-mobile-reference-webapp/blob/master/webapp.json

- Implementation reference document: <br /> http://www.evernote.com/l/AhVPgSj_76JOCpFbK3cD4qFrTmEUDVZKE9Y/

## Data import
- The import command will import data into the database endpoint given as the 1st parameter reading from the json data file supplied as the 2nd parameter.
```
pm import http://mypmapi.endpoint/pm ./app/assets/data.json
```

## Running

A common workflow is outlined below:

```
pm api <pm-api-gateway-url>
pm auth <user> <password>
pm import <destination-database> <path/to/initial/data.json>
pm define <path-to-app.json>
pm grant --user=<username>
pm revoke --user=<username>
pm publish <path-to-webapp.json> --app <app-name>
```

The above command sequence will:

- Target a specified `pm-api-gateway`
- Authenticate as a specified user.
- Imports the data at initial-json-data to destination-database.
- Upload an app.json file to the target server.
- Grant access to a user for the new app.
- Revoke access to a user for the new app.
- Publish a webapp to the new app.
