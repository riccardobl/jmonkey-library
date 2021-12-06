 
#!/bin/bash
set -e
# Select runtime
if [ "$RUNTIME" = "" ];
then
    export RUNTIME="`which podman`"
    if [ "$RUNTIME" = "" ];
    then
        export RUNTIME="`which docker`"
    fi
fi

# Rebuild image
# $RUNTIME rmi jmelibrary || true
$RUNTIME stop jmelibrary || true
$RUNTIME rm jmelibrary||true


# Set production/debug args
export ARGS="-d --restart=always --read-only"
export DOCKERFILE="$PWD/Dockerfile"
if [ "$PRODUCTION" != "" ]; # Production
then

    # Prepare configuration
    if [ "$TMP_PATH" = "" ];then  export TMP_PATH="/srv/jmelibrary/tmp"; fi
    if [ "$UPLOADS_PATH" = "" ];then  export UPLOADS_PATH="/srv/jmelibrary/uploads"; fi
    if [ "$DATABASE_PATH" = "" ];then  export DATABASE_PATH="/srv/jmelibrary/database"; fi
    if [ "$CONFIG_PATH" = "" ];then  export CONFIG_PATH="/srv/jmelibrary/config"; fi

else #Dev

    if [ "$PORT" = "" ];then export PORT="8080"; fi
    export ARGS="-it --rm -p8080:$PORT -v$PWD/backend:/app/backend -v$PWD/frontend:/app/frontend -v$PWD/common:/app/common"
    export DOCKERFILE="$PWD/Dockerfile.dev"

    # Prepare configuration
    if [ "$TMP_PATH" = "" ];then  export TMP_PATH="$PWD/test_environment/docker/tmp"; fi
    if [ "$UPLOADS_PATH" = "" ];then  export UPLOADS_PATH="$PWD/test_environment/docker/uploads"; fi
    if [ "$DATABASE_PATH" = "" ];then  export DATABASE_PATH="$PWD/test_environment/docker/database"; fi
    if [ "$CONFIG_PATH" = "" ];then  export CONFIG_PATH="$PWD/config/docker_test_environment"; fi

fi


$RUNTIME build -t jmelibrary -f "$DOCKERFILE" .


# Create local dirs
mkdir -p "$TMP_PATH"
mkdir -p "$UPLOADS_PATH"
mkdir -p "$DATABASE_PATH"

# Fix permissions
chown 1000:1000 -Rvf "$TMP_PATH"
chown 1000:1000 -Rvf  "$UPLOADS_PATH"
chown 1000:1000 -Rvf  "$DATABASE_PATH"
# chown 1000:1000 -Rvf  "$CONFIG_PATH"
chmod 777 -Rvf "$TMP_PATH"

# Run
$RUNTIME run \
$ARGS \
-v$TMP_PATH:/tmp \
-v$UPLOADS_PATH:/uploads \
-v$DATABASE_PATH:/database \
-v$CONFIG_PATH:/config \
-eCONFIG_PATH="/config" \
--name="jmelibrary" \
jmelibrary