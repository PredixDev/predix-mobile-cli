# UAA Utility Scripts

Utility scripts for configuring UAA, and adding developer users for use by the `pm` CLI utility.

## Configure UAA

The `pm-configure-uaa.sh` script can be used to configure the `pm-api-gateway-oauth` OAuth account, `pm` OAuth account, and `pm.admin` user group.

```
./pm-configure-uaa.sh -u admin -s https://0e904b72-0000-0000-0000-fc1be00f817e.predix-uaa-staging.grc-apps.svc.ice.ge.com
(enter UAA admin password when prompted)
```

The `pm-api-gateway-oauth` account is used by the Predix-Mobile service for client authentication, using the `authorization_code` grant type.  

The `pm` account is an `implicit_grant` type account, used by the `pm` cli tool, similar in functionality to the `cf` user account used by the Cloud Foundry `cf` command line tool.

## Add Developer User

Create a developer user on the UAA server, with full access to `pm` cli tool.  This utility creates the user, and grants them access to the `pm.admin` group.

```
./pm-add-developer.sh -e test@ge.com -p test
```

## Troubleshooting

_Note:_ If an error occurs related to authentication not valid, try re-logging into the UAA server, using the standard `uaac` commands, and then execute the user creation operation again:

```
$> uaac target <uaa-server-url> --skip-ssl-validation
$> uaac token client get <username>
(enter UAA admin password when prompted)
```

