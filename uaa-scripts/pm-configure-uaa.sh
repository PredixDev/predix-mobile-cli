#/bin/bash
set -e

while getopts "s:u:" opt; do
    case $opt in
        s)
            uaa_server_url="$OPTARG"
            ;;
        u)
            uaa_admin_username="$OPTARG"
            ;;
        \?)
            echo "Invalid option: -$OPTARG" >&2
            exit 1
            ;;
        :)
            echo "Option -$OPTARG requires an argument." >&2
            exit 1
            ;;
    esac
done

if [[ -z "$uaa_server_url" ]]; then
    echo "Option Required: -s <uaa-url>"
    echo "Specify the URI of the target UAA server. e.g. https://uaa-host-name/"
    exit 1
fi

if [[ -z "$uaa_admin_username" ]]; then
    echo "Option Required: -u <uaa-admin-user>"
    echo "Specify the username of the admin user on the target UAA server. e.g. admin"
    exit 1
fi

# Target specified UAA server.
uaac target $uaa_server_url --skip-ssl-validation
# Authenticate with UAA, and prompt user for password.
uaac token client get $uaa_admin_username

# Create `pm-api-gateway-oauth` OAuth client account.
uaac client add "pm-api-gateway-oauth" --authorities "uaa.resource" --scope "openid" --autoapprove "openid" --authorized_grant_types "authorization_code,client_credentials,refresh_token" --secret "Pr3dixMob1le"

# Create `pm` OAuth client account.
uaac client add "pm" --authorities "uaa.resource" --scope "openid" --autoapprove "openid" --authorized_grant_types "implicit,password,refresh_token" --secret ""

# Create `pm.admin` user group.
uaac group add pm.admin

echo "OK"
