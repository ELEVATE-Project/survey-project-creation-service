# 🚀 Survey-Project-Creation-Service Release 1.0.0.34

## New Features

### APIs

- **Entity Type List Based on State**
  - Endpoint: `{{baseURL}}/scp/targeting/hierarchy/:stateId`

- **Fetch Sub Entity Based on Multiple Parent IDs**
  - Endpoint: `{{baseURL}}/scp/targeting/subEntityList/:stateId?subEntityType=:subEntityType`

- **Republish API (Project)**
  - Allows users with creator, reviewer, or admin roles to republish a project if it fails to publish for any reason.

**Note:** API details have been added to the API documentation.