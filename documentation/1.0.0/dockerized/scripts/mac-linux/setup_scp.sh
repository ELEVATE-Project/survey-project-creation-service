#!/bin/bash

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> setup_log.txt
}

# Step 1: Download Docker Compose file
log "Downloading Docker Compose file..."
curl -OJL https://github.com/ELEVATE-Project/survey-project-creation-service/raw/main/documentation/1.0.0/dockerized/docker-compose.yml
log "Docker Compose file downloaded."

# Step 2: Download environment files
log "Downloading environment files..."
curl -L \
    -O https://github.com/ELEVATE-Project/survey-project-creation-service/raw/main/documentation/1.0.0/dockerized/envs/survey_project_creation_env \
    -O https://github.com/ELEVATE-Project/survey-project-creation-service/raw/main/documentation/1.0.0/dockerized/envs/interface_env \
    -O https://github.com/ELEVATE-Project/survey-project-creation-service/raw/main/documentation/1.0.0/dockerized/envs/entity_management_env \
    -O https://github.com/ELEVATE-Project/survey-project-creation-service/raw/main/documentation/1.0.0/dockerized/envs/project_env \
    -O https://github.com/ELEVATE-Project/survey-project-creation-service/raw/main/documentation/1.0.0/dockerized/envs/notification_env \
    -O https://github.com/ELEVATE-Project/survey-project-creation-service/raw/main/documentation/1.0.0/dockerized/envs/scheduler_env \
    -O https://github.com/ELEVATE-Project/survey-project-creation-service/raw/main/documentation/1.0.0/dockerized/envs/user_env \
    -O https://github.com/ELEVATE-Project/survey-project-creation-service/raw/main/documentation/1.0.0/dockerized/envs/environment.ts
log "Environment files downloaded."

# Step 3: Download replace_volume_path.sh script
log "Downloading replace_volume_path.sh script..."
curl -OJL https://raw.githubusercontent.com/ELEVATE-Project/survey-project-creation-service/main/documentation/1.0.0/dockerized/scripts/mac-linux/replace_volume_path.sh
log "replace_volume_path.sh script downloaded."

# Step 4: Make replace_volume_path.sh executable
log "Making replace_volume_path.sh executable..."
chmod +x replace_volume_path.sh
log "Made replace_volume_path.sh executable."

# Step 5: Run replace_volume_path.sh script
log "Running replace_volume_path.sh script..."
./replace_volume_path.sh
log "replace_volume_path.sh script executed."

# Step 6: Download additional scripts
log "Downloading docker-compose scripts..."
curl -OJL https://github.com/ELEVATE-Project/survey-project-creation-service/raw/main/documentation/1.0.0/dockerized/scripts/mac-linux/docker-compose-up.sh
curl -OJL https://github.com/ELEVATE-Project/survey-project-creation-service/raw/main/documentation/1.0.0/dockerized/scripts/mac-linux/docker-compose-down.sh
log "docker-compose scripts downloaded."

# Step 7: Make the scripts executable
log "Making docker-compose scripts executable..."
chmod +x docker-compose-up.sh
chmod +x docker-compose-down.sh
log "Made docker-compose scripts executable."

# Step 8: Create user directory and download SQL file
log "Creating user directory and downloading distributionColumns.sql..."
mkdir -p user && curl -o ./user/distributionColumns.sql -JL https://github.com/ELEVATE-Project/survey-project-creation-service/raw/main/documentation/1.0.0/distribution-columns/user/distributionColumns.sql
log "User directory created and distributionColumns.sql downloaded."

# Step 9: Download and make citus_setup.sh executable
log "Downloading citus_setup.sh..."
curl -OJL https://github.com/ELEVATE-Project/survey-project-creation-service/raw/main/documentation/1.0.0/dockerized/scripts/mac-linux/citus_setup.sh
chmod +x citus_setup.sh

# Step 10: Create sample-data directory and download SQL file
log "Creating sample-data directory and downloading sampleData.sql..."
mkdir -p sample-data/user && \
curl -L https://raw.githubusercontent.com/ELEVATE-Project/survey-project-creation-service/main/documentation/1.0.0/sample-data/mac-linux/user/sampleData.sql -o sample-data/user/sampleData.sql
log "Sample-data directory created and sampleData.sql downloaded."

# Step 11: Download and make insert_sample_data.sh executable
log "Downloading insert_sample_data.sh..."
curl -L -o insert_sample_data.sh https://raw.githubusercontent.com/ELEVATE-Project/survey-project-creation-service/main/documentation/1.0.0/dockerized/scripts/mac-linux/insert_sample_data.sh && chmod +x insert_sample_data.sh
log "insert_sample_data.sh downloaded and made executable."

# Step 12: Download and make add_sample_project_entity_data.sh executable
log "Downloading add_sample_project_entity_data.sh..."
curl -OJL https://github.com/ELEVATE-Project/project-service/raw/main/documentation/1.0.0/dockerized/scripts/mac-linux/add_sample_project_entity_data.sh
chmod +x add_sample_project_entity_data.sh
log "add_sample_project_entity_data.sh downloaded and made executable."

# Step 13: Run docker-compose-up.sh script
log "Running docker-compose-up.sh script..."
./docker-compose-up.sh
log "docker-compose-up.sh script executed."
