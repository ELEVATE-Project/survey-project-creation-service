# Survey Project Creation Service (SCP)

The Survey Project Creation Service (SCP) is a comprehensive platform for designing, creating, and managing resources such as projects, surveys, observations, and programs. It provides a flexible, multi-tenant architecture with fine-grained role-based access control and organization-level configuration management.

---

## 📖 Table of Contents

### 🚀 Getting Started (Start Here!)

-   [Quick Overview](#quick-overview) - What is SCP?
-   [Setup and Installation](#setup-and-installation) - Get up and running in 10 minutes
-   [First Steps After Installation](#first-steps-after-installation) - Essential configuration

### 📚 Core Concepts

-   [Architecture Overview](#architecture-overview) - How SCP works
-   [Resource Types](#supported-resource-types) - Projects, Programs, Surveys
-   [Configuration System](#configuration-system) - Instance vs Organization level

### 👥 User Management

-   [Roles at a Glance](#roles-at-a-glance) - Quick reference
-   [Role Permissions (Detailed)](#role-based-access-control-detailed) - Complete RBAC matrix
-   [Common Use Cases](#common-use-cases) - Task-based role guide

### ⚙️ Configuration

-   [Instance Configuration](#instance-configuration) - System-wide defaults
-   [Organization Configuration](#organization-level-configuration) - Per-organization customization
-   [Configuration Override Reference](#configuration-override-reference) - What can be customized

### 🔌 API & Integration

-   [API Endpoints](#api-endpoints) - Available APIs
-   [Support & Resources](#support-and-documentation) - Get help

---

## Quick Overview

**What is SCP?**

SCP is a multi-tenant service that enables organizations to:

-   **Create Resources**: Projects, surveys, observations, and programs
-   **Review & Approve**: Configurable sequential or parallel review workflows
-   **Customize Configuration**: Per-organization settings for different resource types
-   **Manage Access**: Fine-grained role-based permissions
-   **Publish & Deploy**: Rollout resources to target audiences

**Key Features:**

-   ✅ Multi-tenant architecture with organization isolation
-   ✅ Configurable review workflows (sequential/parallel)
-   ✅ Organization-specific customization per resource type
-   ✅ Role-based access control with customizable role names
-   ✅ RESTful API with comprehensive documentation

**Current Status:**

-   ✅ **Production Ready**: Projects, Programs
-   🔄 **In Development**: Surveys, Observations, Observations with Rubrics

---

## Setup and Installation

### Prerequisites

Before you begin, ensure you have:

-   **Node.js** 14 or higher
-   **PostgreSQL** 12 or higher
-   **Redis** (for caching)
-   **Kafka** (optional - for event streaming)
-   **MongoDB** (optional - for content storage)

### Installation Steps

#### 1. Clone the Repository

```bash
git clone https://github.com/ELEVATE-Project/survey-project-creation-service.git
cd survey-project-creation-service
```

#### 2. Install Dependencies

```bash
npm install
```

#### 3. Configure Environment Variables

```bash
# Copy the sample environment file
cp src/.env.sample src/.env

# Edit the .env file with your configuration
nano src/.env  # or use your preferred editor
```

**Critical Environment Variables to Set:**

```bash
# Database Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_DATABASE=scp_db

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Application Configuration
APPLICATION_PORT=6001
APPLICATION_BASE_URL=/scp/

# Authentication (if using external auth service)
USER_SERVICE_HOST=http://localhost:3000
USER_SERVICE_BASE_URL=/user/

# Default Configurations
REVIEW_REQUIRED=true
REVIEW_TYPE=SEQUENTIAL
MIN_APPROVAL=1
```

<details>
<summary><strong>View All Environment Variables</strong></summary>

```bash
# System-Wide Settings
DEFAULT_ADMIN_ROLE=admin
DEFAULT_ORG_ADMIN_ROLE=org_admin
DEFAULT_CONTENT_CREATOR_ROLE=content_creator
DEFAULT_REVIEWER_ROLE=reviewer
DEFAULT_PROGRAM_DESIGNER_ROLES=program_designer
DEFAULT_ROLLOUT_ROLES=rollout_manager

# Technical Limits
RESOURCE_AUTO_SAVE_TIMER=30000
MAX_PROJECT_TASK_COUNT=10
MAX_RESOURCE_NOTE_LENGTH=256
RESOURCE_TYPES="project,observation,observation_with_rubric,survey,program"

# Feature Flags
ENABLE_ENTITY_TAGGING_IN_PROJECTS=true
ENABLE_TASK_START_END_DATE_IN_PROJECTS=false
ENABLE_OBSERVATION_IN_PROJECTS=true

# Manager Roles (for consumption service)
DEFAULT_DATA_MANAGERS="program_manager"
DEFAULT_PROGRAM_MANAGERS="program_manager"

# Kafka (Optional)
PROGRAM_PUBLISH_KAFKA_TOPIC=dev.programpublish
KAFKA_BROKERS=localhost:9092
```

</details>

#### 4. Initialize Database

```bash
# Run database migrations
npm run db:init

# Seed initial data (optional but recommended for testing)
npm run db:seed:all
```

#### 5. Start the Service

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

#### 6. Verify Installation

```bash
# Check health endpoint
curl http://localhost:6001/scp/health

# Expected response:
# {"status": "healthy", "version": "1.0.0"}
```

#### 7. Access API Documentation

Open your browser and navigate to:

```
http://localhost:6001/scp/api-doc
```

---

## First Steps After Installation

### 1. Create Your First Admin User

If using the authentication service, create an admin user through the user service, then assign the `admin` role in SCP.

### 2. Set Up Organization Configuration

Create your first organization configuration:

```bash
POST http://localhost:6001/scp/v1/organization-extensions/createConfig
Headers:
  X-auth-token: <your_admin_token>
  Content-Type: application/json

Body:
{
  "resource_type": "project",
  "review_required": true,
  "review_type": "SEQUENTIAL",
  "min_approval": 1,
  "enable_entity_tagging": true,
  "enable_task_start_end_dates": false
}
```

### 3. Create Review Stages (Optional)

If using review workflows:

```bash
POST http://localhost:6001/scp/v1/review-stages/create
Headers:
  X-auth-token: <your_org_admin_token>
  Content-Type: application/json

Body:
{
  "name": "Initial Review",
  "sequence": 1,
  "resource_type": "project"
}
```

### 4. Test Creating a Resource

Create your first project:

```bash
POST http://localhost:6001/scp/v1/projects/update
Headers:
  X-auth-token: <your_content_creator_token>
  Content-Type: application/json

Body:
{
  "title": "My First Project",
  "description": "Testing SCP setup",
  "status": "draft"
}
```

### 5. Import Postman Collection

For easier testing, import the provided Postman collection:

```
src/configs/SCP_Postman_Collection.json
```

---

## Architecture Overview

SCP follows a layered architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Applications                     │
└─────────────────────┬───────────────────────────────────────┘
                      │ REST API
┌─────────────────────▼───────────────────────────────────────┐
│                     API Layer (Routes)                       │
├──────────────────────────────────────────────────────────────┤
│                  Business Logic (Services)                   │
├──────────────────────────────────────────────────────────────┤
│              Data Access Layer (Repositories)                │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   PostgreSQL      Redis         Kafka
   (Primary DB)   (Cache)       (Events)
```

### Multi-Tenant Architecture

-   **Tenant**: Top-level isolation (e.g., different regions or deployments)
-   **Organization**: Multiple organizations within a tenant
-   **Resource-Specific Config**: Each organization can have different settings per resource type

### Configuration Hierarchy

```
Instance Level (.env)
    │
    └─► Organization Level (API)
            │
            └─► Resource Type Specific (project, program, etc.)
```

**Example**: Instance default is "review required", but Organization A can override to "no review" for projects while keeping review for programs.

---

## Configuration System

### Two-Tier Configuration

SCP uses a **two-tier configuration system**:

1. **Instance Level** (.env file) → Defaults for all organizations
2. **Organization Level** (API) → Overrides for specific organization + resource type

**Why Two Tiers?**

-   **Flexibility**: Different organizations have different workflows
-   **Consistency**: System-wide defaults ensure baseline behavior
-   **Scalability**: Easy to add new organizations without code changes

**Core Principle**: Organization administrators (`org_admin`) can override most instance-level settings for their organization while maintaining instance-wide defaults for others.

---

## Roles at a Glance

### Role Hierarchy

```
System Level
    ├─► admin (Full system access)
    │
Tenant Level
    ├─► tenant_admin (Tenant-wide access)
    │
Organization Level
    ├─► org_admin (Org configuration)
    ├─► content_creator (Create resources)
    ├─► reviewer (Review & approve)
    ├─► program_designer (Design programs)
    └─► rollout_manager (Deploy resources)

Consumption Service Only
    └─► program_manager (Analytics access)
```

### Quick Role Summary

| Role                   | Scope        | Key Responsibilities                                                     |
| ---------------------- | ------------ | ------------------------------------------------------------------------ |
| **`admin`**            | System-wide  | Full system access, database operations, tenant management               |
| **`org_admin`**        | Organization | Configure organizational settings, manage review workflows, create forms |
| **`content_creator`**  | Organization | Create and manage resources, submit for review                           |
| **`reviewer`**         | Organization | Review and approve/reject submissions, provide feedback                  |
| **`program_designer`** | Organization | Design and create programs, bundle resources                             |
| **`program_manager`**  | Organization | **(Consumption Service)** Access reports and analytics after publication |
| **`rollout_manager`**  | Organization | Deploy resources to target audiences                                     |

**Note**: `program_manager` and `data_manager` roles are configured in SCP but provide access only in the consumption service (for reports/analytics), not within SCP itself.

---

## Common Use Cases

### For Administrators

| Task                                    | Required Role | API Endpoint                                        |
| --------------------------------------- | ------------- | --------------------------------------------------- |
| Set up new tenant dependencies          | `admin`       | `POST /scp/v1/admin/createTenantDependencies`       |
| Execute database queries                | `admin`       | `POST /scp/v1/admin/dbFind`                         |
| Configure organization review workflows | `org_admin`   | `POST /scp/v1/organization-extensions/createConfig` |
| Create entity types                     | `org_admin`   | `POST /scp/v1/entity-types/create`                  |
| Create forms                            | `org_admin`   | `POST /scp/v1/forms/create`                         |

### For Content Creators

| Task                      | Required Role     | API Endpoint                                       |
| ------------------------- | ----------------- | -------------------------------------------------- |
| Create a project          | `content_creator` | `POST /scp/v1/projects/update/{id}`                |
| Update draft project      | `content_creator` | `POST /scp/v1/projects/update/{id}`                |
| Submit project for review | `content_creator` | `POST /scp/v1/projects/submitForReview/{id}`       |
| Clone existing project    | `content_creator` | `POST /scp/v1/projects/update` (with reference_id) |

### For Reviewers

| Task                        | Required Role | API Endpoint                                    |
| --------------------------- | ------------- | ----------------------------------------------- |
| View assigned review tasks  | `reviewer`    | `GET /scp/v1/reviews/list`                      |
| Approve a resource          | `reviewer`    | `POST /scp/v1/reviews/create` (approve)         |
| Reject a resource           | `reviewer`    | `POST /scp/v1/reviews/create` (reject)          |
| Request changes to resource | `reviewer`    | `POST /scp/v1/reviews/create` (request changes) |

### For Program Designers

| Task                          | Required Role      | API Endpoint                                 |
| ----------------------------- | ------------------ | -------------------------------------------- |
| Create a program              | `program_designer` | `POST /scp/v1/programs/update/{id}`          |
| Add resources to program      | `program_designer` | `POST /scp/v1/programs/addResources/{id}`    |
| Remove resources from program | `program_designer` | `POST /scp/v1/programs/removeResources/{id}` |
| Submit program for review     | `program_designer` | `POST /scp/v1/programs/submitForReview/{id}` |
| Publish program               | `program_designer` | `POST /scp/v1/programs/publish/{id}`         |

### For Rollout Managers

| Task                     | Required Role     | API Endpoint                        |
| ------------------------ | ----------------- | ----------------------------------- |
| Create rollout plan      | `rollout_manager` | `POST /scp/v1/rollouts/create`      |
| Manage rollout targeting | `rollout_manager` | `PUT /scp/v1/rollouts/update/{id}`  |
| View rollout metrics     | `rollout_manager` | `GET /scp/v1/rollouts/details/{id}` |

**For detailed permissions, see [Complete Role Permissions](#role-based-access-control-detailed) below.**

---

## Instance Configuration

### 🎯 Configuration Architecture

SCP implements a **two-tier configuration system**:

1. **Instance Level** (.env file) → Defaults for all organizations
2. **Organization Level** (API) → Overrides for specific organization + resource type

**Core Principle**: Organization administrators (`org_admin`) can override most instance-level settings for their organization while maintaining instance-wide defaults for others.

---

### 📋 Configuration Override Reference

| Configuration Category              | Instance Level | Organization Override | Override Method     |
| ----------------------------------- | -------------- | --------------------- | ------------------- |
| **Review Settings**                 |                |                       |                     |
| `REVIEW_REQUIRED`                   | ✅ Set default | ✅ YES                | API: `createConfig` |
| `REVIEW_TYPE` (Sequential/Parallel) | ✅ Set default | ✅ YES                | API: `createConfig` |
| `MIN_APPROVAL`                      | ✅ Set default | ✅ YES                | API: `createConfig` |
| `SHOW_REVIEWER_LIST`                | ✅ Set default | ✅ YES                | API: `createConfig` |
| **Feature Flags**                   |                |                       |                     |
| `ENABLE_ENTITY_TAGGING`             | ✅ Set default | ✅ YES                | API: `createConfig` |
| `ENABLE_TASK_DATES`                 | ✅ Set default | ✅ YES                | API: `createConfig` |
| `ENABLE_OBSERVATION`                | ✅ Set default | ✅ YES                | API: `createConfig` |
| **Manager Roles**                   |                |                       |                     |
| `DEFAULT_DATA_MANAGERS`             | ✅ Set default | ✅ YES                | API: `createConfig` |
| `DEFAULT_PROGRAM_MANAGERS`          | ✅ Set default | ✅ YES                | API: `createConfig` |
| **System-Wide Role Names**          |                |                       |                     |
| `DEFAULT_ADMIN_ROLE`                | ✅ Set once    | ❌ NO                 | System-wide only    |
| `DEFAULT_ORG_ADMIN_ROLE`            | ✅ Set once    | ❌ NO                 | System-wide only    |
| `DEFAULT_CONTENT_CREATOR_ROLE`      | ✅ Set once    | ❌ NO                 | System-wide only    |
| `DEFAULT_REVIEWER_ROLE`             | ✅ Set once    | ❌ NO                 | System-wide only    |
| `DEFAULT_PROGRAM_DESIGNER_ROLES`    | ✅ Set once    | ❌ NO                 | System-wide only    |
| **Technical Limits**                |                |                       |                     |
| `RESOURCE_AUTO_SAVE_TIMER`          | ✅ Set once    | ❌ NO                 | System-wide only    |
| `MAX_PROJECT_TASK_COUNT`            | ✅ Set once    | ❌ NO                 | System-wide only    |
| `MAX_RESOURCE_NOTE_LENGTH`          | ✅ Set once    | ❌ NO                 | System-wide only    |

---

### 🔧 Instance-Level Environment Variables

#### System-Wide Settings (Cannot be overridden)

```bash
# Role Names - Apply to entire system
DEFAULT_ADMIN_ROLE=admin
DEFAULT_ORG_ADMIN_ROLE=org_admin
DEFAULT_CONTENT_CREATOR_ROLE=content_creator
DEFAULT_REVIEWER_ROLE=reviewer
DEFAULT_PROGRAM_DESIGNER_ROLES=program_designer
DEFAULT_ROLLOUT_ROLES=rollout_manager

# Technical Limits - Apply to all organizations
RESOURCE_AUTO_SAVE_TIMER=30000              # Auto-save interval (milliseconds)
MAX_PROJECT_TASK_COUNT=10                   # Maximum tasks per project
MAX_RESOURCE_NOTE_LENGTH=256                # Maximum note length
RESOURCE_TYPES="project,observation,observation_with_rubric,survey,program"
```

#### Configurable Defaults (Organization-level override available)

```bash
# Review Configuration
REVIEW_REQUIRED=true                        # ✅ Organization override available
REVIEW_TYPE=SEQUENTIAL                      # ✅ Organization override available (SEQUENTIAL | PARALLEL)
MIN_APPROVAL=1                              # ✅ Organization override available
SHOW_REVIEWER_LIST=true                     # ✅ Organization override available

# Feature Flags
ENABLE_ENTITY_TAGGING_IN_PROJECTS=true      # ✅ Organization override available
ENABLE_TASK_START_END_DATE_IN_PROJECTS=false # ✅ Organization override available
ENABLE_OBSERVATION_IN_PROJECTS=true         # ✅ Organization override available

# Manager Roles (Used by Consumption Service for Analytics/Reports)
DEFAULT_DATA_MANAGERS="program_manager"     # ✅ Organization override available
DEFAULT_PROGRAM_MANAGERS="program_manager"  # ✅ Organization override available
```

---

### 📊 Understanding Manager Roles Configuration

**Important**: `data_managers` and `program_managers` are **configuration-only** settings in SCP. These roles have **no permissions or functionality within SCP itself**.

**Purpose**: When resources (projects, programs) are published from SCP and moved to the **consumption service**, these configured roles determine who can access:

-   Analytics dashboards
-   Report data
-   Participant information
-   Program metrics

**In SCP**:

-   ✅ Configure which roles should have analytics access
-   ❌ No actual analytics or reporting functionality

**In Consumption Service**:

-   ✅ Users with configured roles can access reports/dashboards
-   ✅ View program execution data and metrics

**Example Flow**:

1. Org admin configures `data_managers: ["program_manager"]` in SCP
2. Program designer publishes a program in SCP
3. Program moves to consumption service
4. Users with "program_manager" role can now access analytics in consumption service
5. These roles have no special access in SCP itself

---

## Organization-Level Configuration

### Overriding Instance Defaults

Organization administrators can customize settings for their organization using the SCP API.

**Use Case Example:** Instance requires sequential review with 1 approver by default. A specific organization needs parallel review with 2 approvers.

**Solution:**

```json
{
	"resource_type": "project",
	"review_required": true,
	"review_type": "PARALLEL",
	"min_approval": 2
}
```

### Configuration Process

**Step 1: Authenticate as `org_admin`**

**Step 2: Create Organization Configuration**

```bash
POST /scp/v1/organization-extensions/createConfig
```

**Step 3: Specify Configuration Overrides**

```json
{
	"resource_type": "project",
	"review_required": true,
	"review_type": "PARALLEL",
	"min_approval": 2,
	"enable_entity_tagging": true,
	"enable_task_start_end_dates": true,
	"data_managers": ["program_manager", "analyst"],
	"program_managers": ["program_manager"]
}
```

**Step 4: Verify Configuration**

```bash
GET /scp/v1/config/list
```

**Result:**

-   ✅ Organization uses customized settings (PARALLEL review with 2 approvers)
-   ✅ Other organizations continue using instance defaults
-   ✅ Settings apply only to specified resource type

<details>
<summary><strong>View Complete API Example</strong></summary>

```bash
# Create Configuration
POST /scp/v1/organization-extensions/createConfig
Headers:
  X-auth-token: <org_admin_token>
  Content-Type: application/json

Body:
{
  "resource_type": "project",
  "review_required": true,
  "review_type": "PARALLEL",
  "min_approval": 2,
  "enable_entity_tagging": true,
  "enable_task_start_end_dates": true,
  "data_managers": ["program_manager", "analyst"],
  "program_managers": ["program_manager"]
}

# Verify Configuration
GET /scp/v1/config/list
Headers:
  X-auth-token: <org_admin_token>
```

</details>

### Configurable Settings per Organization

| Setting                       | Description                                                       | Example Value                |
| ----------------------------- | ----------------------------------------------------------------- | ---------------------------- |
| `review_required`             | Require review before publishing                                  | `false` (Direct publishing)  |
| `review_type`                 | Review workflow type                                              | `SEQUENTIAL` or `PARALLEL`   |
| `min_approval`                | Minimum required approvals                                        | `2`                          |
| `enable_entity_tagging`       | Enable entity tagging for resources                               | `true` or `false`            |
| `enable_task_start_end_dates` | Enable task scheduling with dates                                 | `true` or `false`            |
| `data_managers`               | Roles with analytics access _(consumption service only)_          | `["analyst", "manager"]`     |
| `program_managers`            | Roles with program management access _(consumption service only)_ | `["manager", "coordinator"]` |

**Note**: `data_managers` and `program_managers` are configured in SCP to control who can access reports/analytics in the consumption service after resources are published. These roles have no direct functionality within SCP itself.

---

## Role-Based Access Control (Detailed)

<details>
<summary><strong>📋 Complete Role Definitions and Permissions (Click to Expand)</strong></summary>

SCP implements a comprehensive role-based access control (RBAC) system with two role categories:

1. **Administrative Roles** - System and organization-level configuration
2. **Feature-Specific Roles** - Feature and workflow access control

Role names are customizable through environment variables to align with organizational terminology.

**Note**: All authenticated users can access:

-   **`GET /scp/v1/config/list`** - View organizational configurations
-   **`GET /scp/v1/permissions/list`** - View role permissions

---

### Administrative Roles

<details>
<summary><strong>🔐 1. admin (System Administrator)</strong></summary>

**Environment Variable**: `DEFAULT_ADMIN_ROLE=admin`

**Scope**: Entire SCP instance (all tenants and organizations)

**Responsibilities**:

-   Tenant dependency management
-   Database operations execution
-   System-wide configuration management

**Permissions**:

-   ✅ Full read/write access to all resources and configurations
-   ✅ Database query execution (SELECT operations)
-   ✅ Tenant dependency creation
-   ✅ Admin endpoint access
-   ✅ Role-permission mapping management

**Key Endpoints**: `POST /scp/v1/admin/dbFind` &#124; `POST /scp/v1/admin/createTenantDependencies`

</details>

<details>
<summary><strong>🔐 2. org_admin (Organization Administrator)</strong></summary>

**Environment Variable**: `DEFAULT_ORG_ADMIN_ROLE=org_admin`

**Scope**: Single organization within a tenant

**Responsibilities**:

-   Organization-specific configuration for all resource types
-   Organization extension management (resource-type specific)
-   Review stage and workflow management
-   Configure data/program manager roles _(for consumption service access)_
-   Entity type and form setup
-   Certificate and template management

**Permissions**:

-   ✅ Create and update organization-level configurations
-   ✅ Update organization-specific settings per resource type
-   ✅ Manage review stages and workflow configurations
-   ✅ Configure and manage entity types and entities
-   ✅ Create, update, and manage forms and templates
-   ✅ Configure data and program manager roles _(for consumption service)_
-   ✅ Configure observation settings and links
-   ✅ Update certificates and templates
-   ✅ Read organization and resource data
-   ❌ Cannot access other organizations' data
-   ❌ Cannot modify system-wide configurations

**Key Activities**:

-   Configure organizational review workflows
-   Manage entity types and forms
-   Configure data and program manager roles _(controls consumption service access)_
-   Create review stages

</details>

<details>
<summary><strong>🔐 3. tenant_admin (Tenant Administrator)</strong></summary>

**Environment Variable**: `DEFAULT_TENANT_CODE=default`

**Scope**: All organizations within a tenant

**Permissions**: ✅ Tenant-level configuration &#124; ✅ Cross-organization visibility &#124; ✅ Tenant-wide policies

</details>

</details>

---

### Feature-Specific Roles

<details>
<summary><strong>✍️ 1. content_creator (Resource Creator)</strong></summary>

**Environment Variable**: `DEFAULT_CONTENT_CREATOR_ROLE=content_creator`

**Scope**: Resource creation and management within organization

**Permissions**: ✅ Create resources &#124; ✅ Clone via reference_id &#124; ✅ Edit drafts &#124; ✅ Submit for review

</details>

<details>
<summary><strong>✔️ 2. reviewer (Resource Reviewer)</strong></summary>

**Environment Variable**: `DEFAULT_REVIEWER_ROLE=reviewer`

**Scope**: Resource review and approval

**Permissions**: ✅ View review tasks &#124; ✅ Add comments &#124; ✅ Approve/reject &#124; ✅ Request changes

</details>

<details>
<summary><strong>📐 3. program_designer (Program Designer)</strong></summary>

**Environment Variable**: `DEFAULT_PROGRAM_DESIGNER_ROLES=program_designer`

**Scope**: Program design and creation

**Permissions**: ✅ Create programs &#124; ✅ Add/remove resources &#124; ✅ Submit for review &#124; ✅ Publish

</details>

<details>
<summary><strong>🚀 4. rollout_manager (Rollout Manager)</strong></summary>

**Environment Variable**: `DEFAULT_ROLLOUT_ROLES=rollout_manager`

**Scope**: Resource rollout management

**Permissions**: ✅ Create rollouts &#124; ✅ Define targeting &#124; ✅ Schedule rollouts &#124; ✅ Monitor progress

</details>

<details>
<summary><strong>📊 5. program_manager / data_manager (Analytics & Reports Access)</strong></summary>

**Environment Variable**: `DEFAULT_PROGRAM_MANAGERS="program_manager"` & `DEFAULT_DATA_MANAGERS="program_manager"`

**Scope**: **Consumption Service Only** - Analytics and reporting after resource publication

**SCP Configuration**: These roles are configured in SCP via `data_managers` and `program_managers` settings to control who can access reports/analytics in the consumption service.

**Permissions in SCP**: ❌ No direct SCP functionality

**Permissions in Consumption Service**: ✅ View program details &#124; ✅ Access participant data &#124; ✅ View metrics &#124; ✅ Access dashboards

**Note**: SCP only stores the configuration of which roles have analytics access. The actual reports and dashboards are available in the consumption service after resources are published.

</details>

---

### Role Permission Matrix

**Note**: `program_manager` and `data_manager` roles are not included in this matrix as they have no permissions within SCP. They are configured in SCP but only provide access to analytics/reports in the consumption service.

| Operation                 | admin | org_admin | content_creator | reviewer | program_designer | rollout_manager |
| ------------------------- | :---: | :-------: | :-------------: | :------: | :--------------: | :-------------: |
| **Configuration**         |       |           |                 |          |                  |                 |
| Create org config         |  ✅   |    ✅     |       ❌        |    ❌    |        ❌        |       ❌        |
| Update org config         |  ✅   |    ✅     |       ❌        |    ❌    |        ❌        |       ❌        |
| Manage review stages      |  ✅   |    ✅     |       ❌        |    ❌    |        ❌        |       ❌        |
| Create entity types       |  ✅   |    ✅     |       ❌        |    ❌    |        ❌        |       ❌        |
| **Resource Management**   |       |           |                 |          |                  |                 |
| Create resources          |  ✅   |    ✅     |       ✅        |    ❌    |        ✅        |       ❌        |
| Read resources            |  ✅   |    ✅     |       ✅        |    ✅    |        ✅        |       ✅        |
| Update resources          |  ✅   |    ✅     |      ✅\*       |    ❌    |        ✅        |       ❌        |
| Delete resources          |  ✅   |    ✅     |      ✅\*       |    ❌    |        ❌        |       ❌        |
| Submit for review         |  ✅   |    ✅     |       ✅        |    ❌    |        ✅        |       ❌        |
| Publish resources         |  ✅   |    ✅     |      ✅\*       |    ✅    |        ✅        |       ❌        |
| **Review Workflow**       |       |           |                 |          |                  |                 |
| View review tasks         |  ✅   |    ✅     |       ❌        |    ✅    |        ✅        |       ❌        |
| Approve resources         |  ✅   |    ✅     |       ❌        |    ✅    |        ❌        |       ❌        |
| Reject resources          |  ✅   |    ✅     |       ❌        |    ✅    |        ❌        |       ❌        |
| Request changes           |  ✅   |    ✅     |       ❌        |    ✅    |        ❌        |       ❌        |
| **Program Management**    |       |           |                 |          |                  |                 |
| Create programs           |  ✅   |    ✅     |       ❌        |    ❌    |        ✅        |       ❌        |
| Manage programs           |  ✅   |    ✅     |       ❌        |    ❌    |        ✅        |       ❌        |
| **Rollout Management**    |       |           |                 |          |                  |                 |
| Create rollouts           |  ✅   |    ✅     |       ❌        |    ❌    |        ❌        |       ✅        |
| Manage rollouts           |  ✅   |    ✅     |       ❌        |    ❌    |        ❌        |       ✅        |
| View rollout data         |  ✅   |    ✅     |       ❌        |    ❌    |        ❌        |       ✅        |
| **System Administration** |       |           |                 |          |                  |                 |
| Execute DB queries        |  ✅   |    ❌     |       ❌        |    ❌    |        ❌        |       ❌        |
| Manage tenants            |  ✅   |    ❌     |       ❌        |    ❌    |        ❌        |       ❌        |

**Legend**:

-   ✅ = Allowed
-   ❌ = Not allowed
-   ✅\* = Allowed only for owned resources (draft status)

</details>

---

## Supported Resource Types

SCP supports multiple resource types, each with independent configurations, review workflows, and feature settings.

```bash
RESOURCE_TYPES="project,observation,observation_with_rubric,survey,program"
```

### Implementation Status

| Resource Type                | Status               | Description                                             |
| ---------------------------- | -------------------- | ------------------------------------------------------- |
| **Project**                  | ✅ Fully Implemented | Structured improvement projects with tasks and subtasks |
| **Program**                  | ✅ Fully Implemented | Resource collections for coordinated implementation     |
| **Survey**                   | 🔄 In Development    | Questionnaire and feedback collection tools             |
| **Observation**              | 🔄 In Development    | Real-world assessment and evaluation tools              |
| **Observation with Rubrics** | 🔄 In Development    | Rubric-based scoring and evaluation system              |

<details>
<summary><strong>View Detailed Resource Type Information</strong></summary>

### 1. Project ✅ (Fully Implemented)

**Description**: Structured improvement projects with hierarchical task organization

**Key Features**:

-   Hierarchical structure: Projects → Tasks → Sub-tasks
-   Task scheduling with dates (configurable)
-   Evidence tracking for task completion
-   Entity tagging and targeting criteria
-   Multi-stage review support

**Use Cases**: Improvement initiatives, structured training programs, project-based learning

**Configuration Options**:

-   `enable_task_start_end_dates` - Task scheduling
-   `enable_entity_tagging` - Entity tagging
-   `max_task_count` - Task limit per project

**Environment Variables**:

-   `MAX_PROJECT_TASK_COUNT=10`
-   `ENABLE_TASK_START_END_DATE_IN_PROJECTS=false`
-   `ENABLE_ENTITY_TAGGING_IN_PROJECTS=true`
-   `ENABLE_OBSERVATION_IN_PROJECTS=true`

---

### 2. Survey 🔄 (In Development)

**Description**: Data collection and feedback questionnaires

**Status**: Framework implemented, core features in development

**Planned Features**:

-   Multiple question types (multiple choice, text, rating, etc.)
-   Response aggregation
-   Anonymous or identified responses
-   Conditional logic and branching
-   Data export capabilities

**Use Cases**: Feedback collection, assessments, needs analysis

---

### 3. Observation 🔄 (In Development)

**Description**: Real-world assessment and evaluation tools

**Status**: Framework implemented, core features in development

**Planned Features**:

-   Observation rubrics and criteria
-   Real-time data capture
-   Multiple observer support
-   Quantitative and qualitative data collection
-   Evidence documentation

**Use Cases**: Classroom observations, field assessments, quality assurance

**Environment Variables**:

-   `OBSERVATION_DEEP_LINK_REGEX`
-   `ENABLE_OBSERVATION_IN_PROJECTS=true`

---

### 4. Observation with Rubrics 🔄 (In Development)

**Description**: Advanced observation with rubric-based scoring

**Status**: Framework implemented, core features in development

**Planned Features**:

-   Structured rubrics with proficiency levels
-   Scoring matrices and guides
-   Automated score calculation
-   Detailed feedback collection
-   Comparative analysis

**Use Cases**: Standardized evaluations, competency assessments, quality benchmarking

---

### 5. Program ✅ (Fully Implemented)

**Description**: Coordinated resource collections for comprehensive initiatives

**Key Features**:

-   Multiple resource grouping
-   Program-level targeting and rollout
-   Coordinated participant enrollment
-   Program-level analytics
-   Rollout scheduling

**Use Cases**: Comprehensive initiatives, bundled learning programs, coordinated campaigns

**Configuration Options**:

-   `review_required` - Review requirement
-   `show_reviewer_list` - Reviewer visibility
-   `min_approval` - Approval requirements

**Environment Variables**:

-   `PROGRAM_PUBLISH_KAFKA_TOPIC=dev.programpublish`
-   `DEFAULT_PROGRAM_MANAGERS="program_manager"` _(for consumption service access)_
-   `DEFAULT_PROGRAM_DESIGNER_ROLES="program_designer"`

</details>

---

## API Endpoints

### Base URL

```
http://localhost:6001/scp/v1
```

### Authentication

All API requests (except health check) require authentication via `X-auth-token` header:

```bash
X-auth-token: <your_jwt_token>
```

### Configuration & Administration

| Method | Endpoint                                            | Role              | Description                       |
| ------ | --------------------------------------------------- | ----------------- | --------------------------------- |
| GET    | `/scp/v1/config/list`                               | Any authenticated | List current configurations       |
| POST   | `/scp/v1/organization-extensions/createConfig`      | `org_admin`       | Create organization configuration |
| PUT    | `/scp/v1/organization-extensions/updateConfig/{id}` | `org_admin`       | Update organization configuration |
| POST   | `/scp/v1/admin/createTenantDependencies`            | `admin`           | Create tenant dependencies        |
| POST   | `/scp/v1/admin/dbFind`                              | `admin`           | Execute database queries          |

### Entity & Form Management

| Method | Endpoint                      | Role        | Description        |
| ------ | ----------------------------- | ----------- | ------------------ |
| POST   | `/scp/v1/entity-types/create` | `org_admin` | Create entity type |
| GET    | `/scp/v1/entity-types/list`   | `org_admin` | List entity types  |
| POST   | `/scp/v1/forms/create`        | `org_admin` | Create form        |
| GET    | `/scp/v1/forms/details/{id}`  | `org_admin` | Get form details   |

### Resource Management (Projects)

| Method | Endpoint                                       | Role              | Description              |
| ------ | ---------------------------------------------- | ----------------- | ------------------------ |
| POST   | `/scp/v1/projects/update/{projectId}`          | `content_creator` | Create or update project |
| GET    | `/scp/v1/projects/details/{projectId}`         | `content_creator` | Get project details      |
| GET    | `/scp/v1/projects/list`                        | `content_creator` | List projects            |
| GET    | `/scp/v1/projects/reviewerList`                | `content_creator` | Get reviewer list        |
| POST   | `/scp/v1/projects/submitForReview/{projectId}` | `content_creator` | Submit for review        |
| DELETE | `/scp/v1/projects/delete/{projectId}`          | `content_creator` | Delete draft project     |

### Program Management

| Method | Endpoint                                        | Role               | Description                   |
| ------ | ----------------------------------------------- | ------------------ | ----------------------------- |
| POST   | `/scp/v1/programs/update/{id}`                  | `program_designer` | Create or update program      |
| GET    | `/scp/v1/programs/details/{id}`                 | `program_designer` | Get program details           |
| GET    | `/scp/v1/programs/list`                         | `program_designer` | List programs                 |
| POST   | `/scp/v1/programs/addResources/{program_id}`    | `program_designer` | Link resources to program     |
| POST   | `/scp/v1/programs/removeResources/{program_id}` | `program_designer` | Remove resources from program |
| POST   | `/scp/v1/programs/submitForReview/{id}`         | `program_designer` | Submit program for review     |
| POST   | `/scp/v1/programs/publish/{id}`                 | `program_designer` | Publish program               |

### Review Management

| Method | Endpoint                             | Role       | Description        |
| ------ | ------------------------------------ | ---------- | ------------------ |
| POST   | `/scp/v1/reviews/create`             | `reviewer` | Create review      |
| GET    | `/scp/v1/reviews/list`               | `reviewer` | List review tasks  |
| GET    | `/scp/v1/reviews/details/{reviewId}` | `reviewer` | Get review details |

### Rollout Management

| Method | Endpoint                        | Role              | Description         |
| ------ | ------------------------------- | ----------------- | ------------------- |
| POST   | `/scp/v1/rollouts/create`       | `rollout_manager` | Create rollout      |
| GET    | `/scp/v1/rollouts/list`         | `rollout_manager` | List rollouts       |
| GET    | `/scp/v1/rollouts/details/{id}` | `rollout_manager` | Get rollout details |
| PUT    | `/scp/v1/rollouts/update/{id}`  | `rollout_manager` | Update rollout      |

---

## Troubleshooting

### Common Issues

<details>
<summary><strong>Database Connection Failed</strong></summary>

**Symptom**: Error connecting to PostgreSQL

**Solution**:

1. Verify PostgreSQL is running: `sudo systemctl status postgresql`
2. Check credentials in `.env` file
3. Ensure database exists: `psql -U postgres -c "CREATE DATABASE scp_db;"`
4. Verify network connectivity if using remote database

</details>

<details>
<summary><strong>Redis Connection Error</strong></summary>

**Symptom**: Cannot connect to Redis

**Solution**:

1. Check if Redis is running: `redis-cli ping` (should return PONG)
2. Start Redis: `sudo systemctl start redis`
3. Verify Redis configuration in `.env`

</details>

<details>
<summary><strong>Authentication Token Invalid</strong></summary>

**Symptom**: 401 Unauthorized errors

**Solution**:

1. Ensure user service is running (if using external auth)
2. Verify token format in `X-auth-token` header
3. Check token expiration
4. Regenerate token if needed

</details>

<details>
<summary><strong>Migration Fails</strong></summary>

**Symptom**: Database migration errors

**Solution**:

1. Drop and recreate database: `npm run db:drop && npm run db:init`
2. Check for existing migration locks
3. Ensure database user has proper permissions
4. Review migration logs for specific errors

</details>

### Getting Help

If you encounter issues not covered here:

1. Check the [GitHub Issues](https://github.com/ELEVATE-Project/survey-project-creation-service/issues)
2. Review API documentation at `/scp/api-doc`
3. Enable debug logging: Set `LOG_LEVEL=debug` in `.env`
4. Create a new issue with:
    - SCP version
    - Environment details
    - Steps to reproduce
    - Error logs

---

## Best Practices

### Configuration Management

1. **Version Control**: Keep `.env.sample` updated but never commit `.env` with secrets
2. **Environment-Specific Config**: Use different `.env` files for dev, staging, production
3. **Document Changes**: Maintain a changelog for configuration updates
4. **Test Review Workflows**: Thoroughly test review stages before production deployment
5. **Backup Configuration**: Export organization configurations before major updates

### Security

1. **Rotate Tokens**: Regularly rotate authentication tokens
2. **Least Privilege**: Assign minimum required roles to users
3. **Audit Logs**: Enable and monitor audit logging for admin actions
4. **Secure Secrets**: Use environment variables or secret management tools
5. **Database Access**: Restrict database access to admin role only

### Performance

1. **Redis Caching**: Ensure Redis is properly configured for optimal caching
2. **Database Indexing**: Monitor slow queries and add indexes as needed
3. **Connection Pooling**: Configure appropriate connection pool sizes
4. **Auto-Save Tuning**: Adjust `RESOURCE_AUTO_SAVE_TIMER` based on user feedback
5. **Pagination**: Use pagination for list endpoints with large datasets

### Multi-Tenant Deployments

1. **Tenant Isolation**: Verify data isolation between tenants
2. **Resource Limits**: Set appropriate limits per organization
3. **Monitoring**: Implement per-tenant monitoring and alerting
4. **Backup Strategy**: Schedule regular backups with tenant-level granularity
5. **Load Balancing**: Distribute load across multiple instances for large deployments

---

## Support and Documentation

### Resources

-   **📖 API Documentation**: [https://dev.elevate-apis.shikshalokam.org/scp/api-doc](https://dev.elevate-apis.shikshalokam.org/scp/api-doc)
-   **📦 Postman Collection**: `src/configs/SCP_Postman_Collection.json`
-   **💻 GitHub Repository**: [https://github.com/ELEVATE-Project/survey-project-creation-service](https://github.com/ELEVATE-Project/survey-project-creation-service)
-   **🐛 Issue Tracker**: [https://github.com/ELEVATE-Project/survey-project-creation-service/issues](https://github.com/ELEVATE-Project/survey-project-creation-service/issues)

### Community

-   **Discussions**: GitHub Discussions for Q&A and feature requests
-   **Contributing**: See `CONTRIBUTING.md` for contribution guidelines
-   **Code of Conduct**: See `CODE_OF_CONDUCT.md`

### Getting Support

For technical support:

1. Search existing issues on GitHub
2. Review API documentation and Postman collection
3. Check troubleshooting section above
4. Create a detailed issue if problem persists

For security vulnerabilities:

-   **DO NOT** create public issues
-   Email security concerns to the maintainers
-   Follow responsible disclosure practices

---

## License

This project is licensed under the terms specified in the LICENSE file.

---

## Changelog

### Version 1.0.0 (Latest)

-   ✅ Production-ready project and program management
-   ✅ Configurable review workflows
-   ✅ Multi-tenant architecture
-   ✅ Role-based access control
-   🔄 Surveys, observations (in development)

For detailed version history, see [CHANGELOG.md](CHANGELOG.md)
