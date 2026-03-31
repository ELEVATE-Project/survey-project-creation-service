# Release v1.0.0 Deployment Guide

This document outlines the detailed deployment steps, environment changes, migrations, and post-deployment script executions for the **v1.0.0 production release** of the Survey Project Creation Service.

---

## General Notes

-   All environment variables must be verified before deployment.
-   Execute migration scripts and setup scripts only after successful deployment of the service.
-   For Docker-based deployments, update the image tag to the latest version as specified.
-   For PM2 deployments, use the specified branch name.

> ⚠️ **For cURLs mentioned, Token and domain values vary based on environment: make sure you pass valid token and domain for the environment. Valid token can be optained from engineering team. Due to security issues token is not provided in the documentation**
>
> -   **Elevate Prod:** `https://elevate-apis.shikshalokam.org`

---

## Survey Project Creation Service
### 1. Environment Changes

**Add (if not present):**

```
# --- Application Configuration ---
# Required port number for the service
"APPLICATION_PORT": "6001"
# Required host address
"APPLICATION_HOST": "localhost"
# Required application base path
"APPLICATION_BASE_URL": "/scp/"
# Required node environment (production/development)
"APPLICATION_ENV": "production"
# Required api doc endpoint
"API_DOC_URL": "/api-doc"
# Redis Host connectivity URL
"REDIS_HOST": "redis://localhost:6379"

# --- Authentication & Auth Config ---
# Required authentication method (native/jwt_only)
"AUTH_METHOD": "native"
# Required auth config file path
"AUTH_CONFIG_FILE_PATH": "config.json"
# Required access token secret for JWT verification
"ACCESS_TOKEN_SECRET": ""
# Internal access token for inter-service communication
"INTERNAL_ACCESS_TOKEN": ""
# Required auth token header name
"AUTH_TOKEN_HEADER_NAME": "x-auth-token"
# Required admin token header name
"ADMIN_TOKEN_HEADER_NAME": "admin-auth-token"
# Required admin access token for privileged operations
"ADMIN_ACCESS_TOKEN": "token"
# Required organization id header name
"ORG_ID_HEADER_NAME": "organization_id"
# Required tenant id header name
"TENANT_ID_HEADER_NAME": "tenant_id"
# Required Session Verification Method
"SESSION_VERIFICATION_METHOD": "user_service_authenticated"
# Indicates if the auth token is a Bearer token
"IS_AUTH_TOKEN_BEARER": "false"

# --- Cloud Storage (GCP/AWS/AZURE/OCI) ---
# Required cloud storage provider
"CLOUD_STORAGE_PROVIDER": ""
"CLOUD_STORAGE_ACCOUNTNAME": ""
# Required cloud storage secret/identity
"CLOUD_STORAGE_SECRET": ""
# Required cloud storage bucket/container name
"CLOUD_STORAGE_BUCKETNAME": ""
"CLOUD_STORAGE_REGION": ""
"CLOUD_STORAGE_PROJECT": ""
"CLOUD_ENDPOINT": ""

# --- Database Configuration (Postgres & MongoDB) ---
# Postgres database connection URL for migrations
"DEV_DATABASE_URL": "postgres://user:password@localhost:5432/elevate-scp"
# MongoDB connection URL for the service
"MONGODB_URL": "mongodb://localhost:27017/dev_saas_elevate_project_v3"
# MongoDB connection URL for Projects (used in individual mode)
"PROJECT_MONGO_DB_URL": "mongodb://localhost:27017/elevate-project"
# MongoDB connection URL for Survey (used in individual mode)
"SURVEY_MONGO_DB_URL": "mongodb://localhost:27017/saas_qa_samiksha"
# MongoDB connection URL for Entity (used in individual mode)
"ENTITY_MONGODB_URL": "mongodb://localhost:27017/saas_elevate_entity"
# Projects MongoDB URL reference
"PROJECTS_MONGODB_URL": "mongodb://localhost:27017/dev_saas_elevate_project_v3"
# Mongo DB mode: "individual" or "shared"
"MONGO_DB_MODE": "shared"
# Shared MongoDB URL (used in shared mode)
"SHARED_MONGO_DB_URL": "mongodb://localhost:27017/dev_saas_elevate_project_v3"

# --- Kafka Configuration ---
# Enable/Disable Kafka communications
"KAFKA_COMMUNICATIONS_ON_OFF": "ON"
# Required Kafka connectivity URL
"KAFKA_URL": "localhost:9092"
# Required Kafka group ID
"KAFKA_GROUP_ID": "scp"
# Indicates if resource metadata should be pushed to Kafka on publish
"RESOURCE_KAFKA_PUSH_ON_OFF": "ON"
# Kafka topic for project publication events
"PROJECT_PUBLISH_KAFKA_TOPIC": "publishtopic"
# Kafka topic for rollout publication events
"ROLLOUT_PUBLISH_KAFKA_TOPIC": "rolloutpublishtopic"
# Kafka topic for program publication events
"PROGRAM_PUBLISH_KAFKA_TOPIC": "programpublishtopic"
# Kafka topic for organization update events (from user service)
"USER_SERVICE_ORG_UPDATE_TOPIC": "dev.organizationEvent"
# Kafka topic for tenant creation events (from user service)
"USER_SERVICE_TENANT_CREATION_TOPIC": "dev.tenantEvent"

# --- Service Hosts & Base URLs ---
# Required User Service host address
"USER_SERVICE_HOST": "http://localhost:3001"
# Required User Service base path
"USER_SERVICE_BASE_URL": "/user/"
# Interface Service host address
"INTERFACE_SERVICE_HOST": "http://localhost:3567"
# Entity Management service base path
"ENTITY_MANAGEMENT_SERVICE_NAME": "/entity-management/"

# --- Consumption Service Integration ---
# Target consumption service (e.g., self, sunbird, elevate)
"CONSUMPTION_SERVICE": "elevate"
# Consumption service base path
"CONSUMPTION_SERVICE_BASE_URL": "/project/"
# Consumption service base path for entity management
"CONSUMPTION_SERVICE_ENTITY_MANAGEMENT_BASE_URL": "/entity-management/"
# Consumption side pre-signed URL endpoint
"CONSUMPTION_SERVICE_PRESIGNED_URL": "v1/cloud-services/files/preSignedUrls"
# Consumption side downloadable URL endpoint
"CONSUMPTION_SERVICE_DOWNLOADBLE_URL": "v1/cloud-services/files/download"
# Required project publish endpoint on consumption side
"PROJECT_PUBLISH_END_POINT": "v1/scp/publishTemplateAndTasks"
# Consumption side Base URL for Projects Service
"PROJECT_SERVICE_BASE_URL": "/project/"
# Consumption side Base URL for Survey Service
"SURVEY_SERVICE_BASE_URL": "/survey/"
# Consumption side metadata info keys
"PROGRAM_META_INFO_KEYS": "state,recommendedFor"

# --- Default Roles & Permissions ---
# Default organization ID
"DEFAULT_ORG_ID": "default"
# Required Default Content Creator Role
"DEFAULT_CONTENT_CREATOR_ROLE": "content_creator"
# Default reviewer role name
"DEFAULT_REVIEWER_ROLE": "reviewer"
# Required Default Org Admin Role
"DEFAULT_ORG_ADMIN_ROLE": "org_admin"
# Required Default Admin Role
"DEFAULT_ADMIN_ROLE": "admin"
# Default roles designated as Data Managers
"DEFAULT_DATA_MANAGERS": "program_manager,program_designer"
# Default roles permitted to perform rollouts
"DEFAULT_ROLLOUT_ROLES": "rollout_manager"
# Default developer/designer roles for programs
"DEFAULT_PROGRAM_DESIGNER_ROLES": "program_designer"
# Default manager roles for programs
"DEFAULT_PROGRAM_MANAGERS": "program_manager"

# --- Endpoint Configurations ---
# Required Organization read API endpoint
"ORGANIZATION_READ_ENDPOINT": "v1/organization/read"
# Required user search/list API endpoint
"USER_LIST_ENDPOINT": "v1/account/search"
# Required user profile read API endpoint
"USER_PROFILE_DETAILS_ENDPOINT": "v1/user/read"

# --- Feature Flags & Other Config ---
# Enable/Disable observation features in projects
"ENABLE_OBSERVATION_IN_PROJECTS": "false"
# Required resource types for the service
"RESOURCE_TYPES": "project,observation,observation_with_rubric,survey,program"
# Required project deep link endpoint
"PROJECT_DEEP_LINK_URL": "https://dev.elevate-ml.shikshalokam.org/view/project/"
# Required Project Reflection Task Redirect URL
"PROJECT_REFLECTION_TASK_REDIRECT_URL": "https://elevate-mitra.shikshalokam.org/mohini/sso?flow=guest-mi-story"
```

### 2. Migrations

After deployment, run the database migrations using Sequelize:

```bash
cd src
npx sequelize-cli db:migrate
```

### 3. Scripts

Run the following scripts sequentially for initial setup and data creation:

```bash
# S1. Add Default Entities for Education Sector
node src/scripts/addDefaultEntitiesForEducationSector.js

# S2. Upload Default Certificate Template
node -r module-alias/register src/scripts/uploadCertificateBaseTemplate.js

# S3. Setup Tenant Data
Run this script for all tenants and organizations that require SCP features for their default organization.

```bash
# Example for shikshalokam tenant and its default organization
node src/scripts/setupTenant.js --tenant_code=shikshalokam --organization_code=shikshalokam
```

**Parameters:**
- `--tenant_code`: The unique code of the tenant (e.g., `shikshalokam`).
- `--organization_code`: The unique code of the organization within that tenant (e.g., `shikshalokam`).

**Note:** This script copies default configurations (entity types, forms, review stages, etc.) from the system default tenant/org to the specified tenant/org. Ensure all relevant tenants are processed.

### 4. PM2 Deployment

-   **Branch:** `release-1.0`

### 5. Docker Deployment

-   **Image Tag:** `shikshalokamqa/survey-project-creation-service:1.0`

---

## Post-Deployment Service Integration (User Service)

### 1. Enable SCP Feature for Organizations

The `scp` (Survey Project Creation) feature must be enabled for each organization in the User Service.

#### Step A: Check if the feature is already enabled
Use the following CURL command to check the status of the `scp` feature for an organization.

```bash
curl --location 'https://elevate-apis.shikshalokam.org/user/v1/organization-feature/read/scp' \
--header 'X-auth-token: {{admin_token}}' \
--header 'organizationcode: default_code' \
--header 'tenantcode: shikshalokam'
```

#### Step B: Enable the feature (if not enabled)
If the feature is not enabled (or `enable` is `false`), run the following CURL command to enable it.

```bash
curl --location --request PATCH 'https://elevate-apis.shikshalokam.org/user/v1/organization-feature/update/scp' \
--header 'X-auth-token: {{admin_token}}' \
--header 'organizationcode: default_code' \
--header 'tenantcode: shikshalokam' \
--header 'Content-Type: application/json' \
--data '{
    "enable": "true"
}'
```

---
