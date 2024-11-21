#!/bin/bash

# Get the directory of the shell script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

log "$SCRIPT_DIR script directory"

# Set environment variables
export notification_env="$SCRIPT_DIR/notification_env"
export scheduler_env="$SCRIPT_DIR/scheduler_env"
export survey_project_creation_env="$SCRIPT_DIR/survey_project_creation_env"
export users_env="$SCRIPT_DIR/user_env"
export interface_env="$SCRIPT_DIR/interface_env"

# Run docker-compose
docker-compose -f "$SCRIPT_DIR/docker-compose.yml" up
