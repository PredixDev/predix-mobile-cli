#/bin/bash
set -e

while getopts "e:p:" opt; do
    case $opt in
	e)
	    user_email=$OPTARG
	    ;;
        p)
            user_password=$OPTARG
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

if [[ -z "$user_email" ]]; then
    echo "Option Required: -e <user-email>"
    echo "Specify the email address of the user to create on the current target UAA server. e.g. test@ge.com"
    exit 1
fi

if [[ -z "$user_password" ]]; then
    echo "Option Required: -p <user-password>"
    echo "Specify the password of the new user."
    exit 1
fi


echo "Adding developer user to UAA: $user_email"

# Create user in currently targeted UAA server.
uaac user add $user_email --emails $user_email --password $user_password

# Add `pm.admin` group to user.
uaac member add pm.admin $user_email

echo "OK"
