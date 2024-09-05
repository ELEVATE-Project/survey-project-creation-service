# Dev-Ops Folder

This folder contains all the necessary files to run Docker images for integration testing of various services, such as the user service, scheduler service, and other supporting services, including Kafka, MongoDB, Redis, PostgreSQL, Zookeeper, etc. The configuration files here are specifically designed to be utilized by CircleCI for continuous integration (CI) testing.

## Contents

- **integration_test.scheduler.env**:  
  Environment variables required to run the Scheduler service during integration testing.

- **integration_test.self_creation_portal.env**:  
  Environment variables for the Self-Creation Portal service, defining necessary configurations and settings.

- **integration_test.user.env**:  
  Environment variables to configure the User service during integration testing.

- **readme.md**:  
  This README file provides an overview of the folder contents and their purposes.

- **testing-docker-compose.yml**:  
  Docker Compose file that defines the services, networks, and volumes required to run integration tests. This file orchestrates the deployment of all the necessary Docker containers, including user service, scheduler service, Kafka, MongoDB, Redis, PostgreSQL, and Zookeeper.

## Purpose

The files in this folder are designed to streamline the setup of integration tests by automating the deployment of necessary services in a controlled Docker environment. This setup ensures consistent testing across various environments and helps maintain a high-quality codebase by enabling continuous integration testing using CircleCI.

## Usage

1. **CircleCI Integration**:  
   This folder is integrated into the CircleCI pipeline. When a build is triggered, CircleCI will use the `testing-docker-compose.yml` file to bring up all necessary Docker containers required for testing.

2. **Environment Variables**:  
   The `.env` files (`integration_test.scheduler.env`, `integration_test.self_creation_portal.env`, `integration_test.user.env`) contain environment-specific configurations for different services. Make sure these files are updated with the correct values before triggering tests.

3. **Running Locally**:  
   If you wish to run the services locally for testing purposes:
   ```sh
   docker-compose -f testing-docker-compose.yml up --build
