# Survey Project Creation Service (SCP)

The Survey Project Creation Service (SCP) is a comprehensive platform for designing, creating, and managing resources such as projects, surveys, observations, and programs. It provides a flexible, multi-tenant architecture with fine-grained role-based access control and organization-level configuration management.

---

## 📖 Documentation Guide

### 🚀 Quick Start (5 minutes)

-   [Overview](#overview) - Core concepts and features
-   [Roles at a Glance](#roles-at-a-glance) - Role-based access control summary
-   [Installation](#setup-and-installation) - Setup and deployment

### ⚙️ Configuration (15 minutes)

-   [Instance Configuration](#instance-configuration) - System-wide defaults
-   [Configuration Override Reference](#configuration-override-reference) - What can be customized
-   [Organization Configuration](#organization-level-configuration) - Per-organization customization

### 📚 Advanced Topics (30+ minutes)

-   [Complete Role Permissions](#role-based-access-control-detailed) - Detailed RBAC matrix
-   [Resource Types](#supported-resource-types) - Projects, surveys, programs
-   [API Reference](#api-endpoints) - Complete endpoint documentation

---

## Overview

SCP is built with a multi-tenant architecture that supports:

-   **Multiple Resource Types**: ✅ **Fully Implemented**: Projects, Programs | 🔄 **Upcoming**: Surveys, Observations, Observations with Rubrics
-   **Flexible Review Workflows**: Sequential or parallel review processes
-   **Organization-Specific Customization**: Each organization can override instance defaults per resource type
-   **Comprehensive Role-Based Access Control**: admin, org_admin, tenant_admin, content_creator, reviewer, program_designer, program_manager, rollout_manager, and more
-   **Component Management**: Configurable components, review stages, entities, and forms
-   **Customizable Roles**: All role names can be customized via environment variables to match organizational terminology

---

## Roles at a Glance

### Quick Role Summary

| Role                   | Scope        | Key Responsibilities                                                     |
| ---------------------- | ------------ | ------------------------------------------------------------------------ |
| **`admin`**            | System-wide  | Full system access, database operations, tenant management               |
| **`org_admin`**        | Organization | Configure organizational settings, manage review workflows, create forms |
| **`content_creator`**  | Organization | Create and manage resources, submit for review                           |
| **`reviewer`**         | Organization | Review and approve/reject submissions, provide feedback                  |
| **`program_designer`** | Organization | Design and create programs, bundle resources                             |
| **`program_manager`**  | Organization | Execute programs, monitor analytics                                      |
| **`rollout_manager`**  | Organization | Deploy resources to target audiences                                     |

### Common Use Cases

| Task                                     | Required Role                                        |
| ---------------------------------------- | ---------------------------------------------------- |
| Create a project                         | `content_creator`                                    |
| Approve a project                        | `reviewer`                                           |
| Configure organizational review settings | `org_admin`                                          |
| Access analytics dashboard               | `program_manager` or role defined in `data_managers` |
| Create a program                         | `program_designer`                                   |
| Deploy resources to end users            | `rollout_manager`                                    |
| Execute database queries                 | `admin`                                              |
| Configure review workflows               | `org_admin`                                          |

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
| `REVIEW_REQUIRED`                   | ✅ Set default | ✅ **YES**            | API: `createConfig` |
| `REVIEW_TYPE` (Sequential/Parallel) | ✅ Set default | ✅ **YES**            | API: `createConfig` |
| `MIN_APPROVAL`                      | ✅ Set default | ✅ **YES**            | API: `createConfig` |
| `SHOW_REVIEWER_LIST`                | ✅ Set default | ✅ **YES**            | API: `createConfig` |
| **Feature Flags**                   |                |                       |                     |
| `ENABLE_ENTITY_TAGGING`             | ✅ Set default | ✅ **YES**            | API: `createConfig` |
| `ENABLE_TASK_DATES`                 | ✅ Set default | ✅ **YES**            | API: `createConfig` |
| `ENABLE_OBSERVATION`                | ✅ Set default | ✅ **YES**            | API: `createConfig` |
| **Manager Roles**                   |                |                       |                     |
| `DEFAULT_DATA_MANAGERS`             | ✅ Set default | ✅ **YES**            | API: `createConfig` |
| `DEFAULT_PROGRAM_MANAGERS`          | ✅ Set default | ✅ **YES**            | API: `createConfig` |
| **System-Wide Role Names**          |                |                       |                     |
| `DEFAULT_ADMIN_ROLE`                | ✅ Set once    | ❌ **NO**             | System-wide only    |
| `DEFAULT_ORG_ADMIN_ROLE`            | ✅ Set once    | ❌ **NO**             | System-wide only    |
| `DEFAULT_CONTENT_CREATOR_ROLE`      | ✅ Set once    | ❌ **NO**             | System-wide only    |
| `DEFAULT_REVIEWER_ROLE`             | ✅ Set once    | ❌ **NO**             | System-wide only    |
| `DEFAULT_PROGRAM_DESIGNER_ROLES`    | ✅ Set once    | ❌ **NO**             | System-wide only    |
| **Technical Limits**                |                |                       |                     |
| `RESOURCE_AUTO_SAVE_TIMER`          | ✅ Set once    | ❌ **NO**             | System-wide only    |
| `MAX_PROJECT_TASK_COUNT`            | ✅ Set once    | ❌ **NO**             | System-wide only    |
| `MAX_RESOURCE_NOTE_LENGTH`          | ✅ Set once    | ❌ **NO**             | System-wide only    |

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

# Manager Roles
DEFAULT_DATA_MANAGERS="program_manager"     # ✅ Organization override available (analytics access)
DEFAULT_PROGRAM_MANAGERS="program_manager"  # ✅ Organization override available (program management)
```

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

| Setting                       | Description                          | Example Value                       |
| ----------------------------- | ------------------------------------ | ----------------------------------- |
| `review_required`             | Require review before publishing     | `false` = Direct publishing enabled |
| `review_type`                 | Review workflow type                 | `SEQUENTIAL` or `PARALLEL`          |
| `min_approval`                | Minimum required approvals           | `2`                                 |
| `enable_entity_tagging`       | Enable entity tagging for resources  | `true` or `false`                   |
| `enable_task_start_end_dates` | Enable task scheduling with dates    | `true` or `false`                   |
| `data_managers`               | Roles with analytics access          | `["analyst", "manager"]`            |
| `program_managers`            | Roles with program management access | `["manager", "coordinator"]`        |

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
-   ✅ Database operations

**Key Endpoints**: `POST /scp/v1/admin/dbFind` | `POST /scp/v1/admin/createTenantDependencies`

</details>

<details>
<summary><strong>🔐 2. org_admin (Organization Administrator)</strong></summary>

**Environment Variable**: `DEFAULT_ORG_ADMIN_ROLE=org_admin`

**Scope**: Single organization within a tenant

**Responsibilities**:

-   Organization-specific configuration for all resource types
-   Organization extension management (resource-type specific)
-   Review stage and workflow management
-   Data and program manager configuration
-   Entity type and form setup
-   Certificate and template management
-   Rollout policy configuration

**Permissions**:

-   ✅ Create and update organization-level configurations
-   ✅ Update organization-specific settings per resource type
-   ✅ Manage review stages and workflow configurations
-   ✅ Configure and manage entity types and entities
-   ✅ Create, update, and manage forms and templates
-   ✅ Set up data and program managers
-   ✅ Configure observation settings and links
-   ✅ Update certificates and templates
-   ✅ Read organization and resource data
-   ❌ Cannot access other organizations' data
-   ❌ Cannot modify system-wide configurations

**Key Activities**:

-   Configure organizational review workflows
-   Manage entity types and forms
-   Configure data and program managers
-   Create review stages

</details>

<details>
<summary><strong>🔐 3. tenant_admin (Tenant Administrator)</strong></summary>

**Environment Variable**: `DEFAULT_TENANT_CODE=default`

**Scope**: All organizations within a tenant

**Permissions**: ✅ Tenant-level configuration | ✅ Cross-organization visibility | ✅ Tenant-wide policies

</details>

</details>

---

<details>
<summary><strong>👥 Feature-Specific Roles (Click to Expand)</strong></summary>

## Feature-Specific Roles

<details>
<summary><strong>✍️ 1. content_creator (Resource Creator)</strong></summary>

**Environment Variable**: `DEFAULT_CONTENT_CREATOR_ROLE=content_creator`

**Scope**: Resource creation and management within organization

**Permissions**: ✅ Create resources | ✅ Clone via reference_id | ✅ Edit drafts | ✅ Submit for review | ✅ Upload media | ✅ Create tasks

</details>

<details>
<summary><strong>✔️ 2. reviewer (Resource Reviewer)</strong></summary>

**Environment Variable**: `DEFAULT_REVIEWER_ROLE=reviewer`

**Scope**: Resource review and approval

**Permissions**: ✅ View review tasks | ✅ Add comments | ✅ Approve/reject | ✅ Request changes

</details>

<details>
<summary><strong>📐 3. program_designer (Program Designer)</strong></summary>

**Environment Variable**: `DEFAULT_PROGRAM_DESIGNER_ROLES=program_designer`

**Scope**: Program design and creation

**Permissions**: ✅ Create programs | ✅ Add/remove resources | ✅ Submit for review | ✅ Publish

</details>

<details>
<summary><strong>📊 4. program_manager (Program Manager / Data Manager)</strong></summary>

**Environment Variable**: `DEFAULT_PROGRAM_MANAGERS="program_manager"` & `DEFAULT_DATA_MANAGERS="program_manager"`

**Scope**: Program execution and data analytics

**Permissions**: ✅ View program details | ✅ Access participant data | ✅ View metrics | ✅ Access dashboards

</details>

<details>
<summary><strong>🚀 5. rollout_manager (Rollout Manager)</strong></summary>

**Environment Variable**: `DEFAULT_ROLLOUT_ROLES='rollout_manager'`

**Scope**: Resource rollout management

**Permissions**: ✅ Create rollouts | ✅ Define targeting | ✅ Schedule rollouts | ✅ Monitor progress

</details>

</details>

---

### Role Permission Matrix

| Operation                 | admin | org_admin | content_creator | reviewer | program_designer | program_manager | rollout_manager |
| ------------------------- | :---: | :-------: | :-------------: | :------: | :--------------: | :-------------: | :-------------: |
| **Configuration**         |
| View configurations       |  ✅   |    ✅     |       ❌        |    ❌    |        ❌        |       ❌        |       ❌        |
| Create org config         |  ✅   |    ✅     |       ❌        |    ❌    |        ❌        |       ❌        |       ❌        |
| Update org config         |  ✅   |    ✅     |       ❌        |    ❌    |        ❌        |       ❌        |       ❌        |
| Manage review stages      |  ✅   |    ✅     |       ❌        |    ❌    |        ❌        |       ❌        |       ❌        |
| Create entity types       |  ✅   |    ✅     |       ❌        |    ❌    |        ❌        |       ❌        |       ❌        |
| **Resource Management**   |
| Create resources          |  ✅   |    ✅     |       ✅        |    ❌    |        ✅        |       ❌        |       ❌        |
| Read resources            |  ✅   |    ✅     |       ✅        |    ✅    |        ✅        |       ✅        |       ✅        |
| Update resources          |  ✅   |    ✅     |      ✅\*       |    ❌    |        ✅        |       ❌        |       ❌        |
| Delete resources          |  ✅   |    ✅     |      ✅\*       |    ❌    |        ❌        |       ❌        |       ❌        |
| Submit for review         |  ✅   |    ✅     |       ✅        |    ❌    |        ✅        |       ❌        |       ❌        |
| Publish resources         |  ✅   |    ✅     |      ✅\*       |    ❌    |        ✅        |       ❌        |       ❌        |
| **Review Workflow**       |
| View review tasks         |  ✅   |    ✅     |       ✅        |    ✅    |        ✅        |       ❌        |       ❌        |
| Approve resources         |  ✅   |    ✅     |       ❌        |    ✅    |        ❌        |       ❌        |       ❌        |
| Reject resources          |  ✅   |    ✅     |       ❌        |    ✅    |        ❌        |       ❌        |       ❌        |
| Request changes           |  ✅   |    ✅     |       ❌        |    ✅    |        ❌        |       ❌        |       ❌        |
| **Program Management**    |
| Create programs           |  ✅   |    ✅     |       ❌        |    ❌    |        ✅        |       ❌        |       ❌        |
| Manage programs           |  ✅   |    ✅     |       ❌        |    ❌    |        ✅        |       ✅        |       ❌        |
| View dashboards           |  ✅   |    ✅     |       ❌        |    ❌    |        ✅        |       ✅        |       ❌        |
| **Rollout Management**    |
| Create rollouts           |  ✅   |    ✅     |       ❌        |    ❌    |        ❌        |       ❌        |       ✅        |
| Manage rollouts           |  ✅   |    ✅     |       ❌        |    ❌    |        ❌        |       ❌        |       ✅        |
| View rollout data         |  ✅   |    ✅     |       ❌        |    ❌    |        ❌        |       ✅        |       ✅        |
| **System Administration** |
| Execute DB queries        |  ✅   |    ❌     |       ❌        |    ❌    |        ❌        |       ❌        |       ❌        |
| Manage tenants            |  ✅   |    ❌     |       ❌        |    ❌    |        ❌        |       ❌        |       ❌        |
| Audit system              |  ✅   |    ❌     |       ❌        |    ❌    |        ❌        |       ❌        |       ❌        |

**Legend**:

-   ✅ = Allowed
-   ❌ = Not allowed
-   ✅\* = Allowed only for owned resources (draft status)

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
-   `DEFAULT_PROGRAM_MANAGERS="program_manager"`
-   `DEFAULT_PROGRAM_DESIGNER_ROLES="program_designer"`

</details>

---

## Setup and Installation

### Prerequisites

-   Node.js 14+
-   PostgreSQL 12+
-   Redis (caching)
-   Kafka (event communication, optional)
-   MongoDB (content storage, optional)

### Installation Steps

1. **Clone Repository**

```bash
git clone https://github.com/ELEVATE-Project/survey-project-creation-service.git
cd survey-project-creation-service/src
```

2. **Install Dependencies**

```bash
npm install
```

3. **Configure Environment**

```bash
cp .env.sample .env
# Edit .env with your configuration
```

4. **Initialize Database**

```bash
npm run db:init
npm run db:seed:all
```

5. **Start Service**

```bash
npm start
```

6. **Verify Deployment**

```bash
curl http://localhost:3000/scp/health
```

---

## API Endpoints

### Configuration & Administration

| Method | Endpoint                                            | Role              | Description                       |
| ------ | --------------------------------------------------- | ----------------- | --------------------------------- |
| GET    | `/scp/v1/config/list`                               | Any authenticated | List current configurations       |
| POST   | `/scp/v1/organization-extensions/createConfig`      | `org_admin`       | Create organization configuration |
| PUT    | `/scp/v1/organization-extensions/updateConfig/{id}` | `org_admin`       | Update organization configuration |
| POST   | `/scp/v1/admin/createTenantDependencies`            | `admin`           | Create tenant dependencies        |
| POST   | `/scp/v1/admin/dbFind`                              | `admin`           | Execute database queries          |

### Resource Management

| Method | Endpoint                                       | Role              | Description              |
| ------ | ---------------------------------------------- | ----------------- | ------------------------ |
| POST   | `/scp/v1/projects/update/{projectId}`          | `content_creator` | Create or update project |
| GET    | `/scp/v1/projects/details/{projectId}`         | `content_creator` | Get project details      |
| GET    | `/scp/v1/projects/reviewerList`                | `content_creator` | Get reviewer list        |
| POST   | `/scp/v1/projects/submitForReview/{projectId}` | `content_creator` | Submit for review        |

### Program Management

| Method | Endpoint                                        | Role                                  | Description                   |
| ------ | ----------------------------------------------- | ------------------------------------- | ----------------------------- |
| POST   | `/scp/v1/programs/update/{id}`                  | `program_designer`                    | Create or update program      |
| GET    | `/scp/v1/programs/details/{id}`                 | `program_designer`, `program_manager` | Get program details           |
| POST   | `/scp/v1/programs/addResources/{program_id}`    | `program_designer`                    | Link resources to program     |
| POST   | `/scp/v1/programs/removeResources/{program_id}` | `program_designer`                    | Remove resources from program |
| POST   | `/scp/v1/programs/submitForReview/{id}`         | `program_designer`                    | Submit program for review     |
| POST   | `/scp/v1/programs/publish/{id}`                 | `program_designer`                    | Publish program               |

### Review Management

| Method | Endpoint                             | Role       | Description        |
| ------ | ------------------------------------ | ---------- | ------------------ |
| POST   | `/scp/v1/reviews/create`             | `reviewer` | Create review      |
| GET    | `/scp/v1/reviews/list`               | `reviewer` | List review tasks  |
| GET    | `/scp/v1/reviews/details/{reviewId}` | `reviewer` | Get review details |

---

## Best Practices

### Configuration Management

1. **Instance Defaults**: Set organization-wide defaults via `.env` file
2. **Organization Overrides**: Use organization-level configurations for specific requirements
3. **Documentation**: Maintain configuration change logs
4. **Testing**: Thoroughly test review workflows before deployment
5. **Limits**: Configure resource limits based on organizational capacity

### Multi-Tenant Deployments

1. **Isolation**: Maintain separate configurations per tenant
2. **Delegation**: Train organization administrators for self-service configuration
3. **Access Control**: Regular audit of administrative role assignments
4. **Workflow Planning**: Define and communicate review stages early

### Performance Optimization

1. **Configuration Caching**: Service restart required after environment changes
2. **Auto-Save Timing**: Adjust `RESOURCE_AUTO_SAVE_TIMER` based on network latency
3. **Approval Limits**: Keep `min_approval` between 1-3 for optimal performance
4. **Data Archival**: Implement soft-delete for unused configurations

---

## Support and Documentation

-   **API Documentation**: `/scp/api-doc`
-   **GitHub Repository**: https://github.com/ELEVATE-Project/survey-project-creation-service
-   **Issue Tracker**: https://github.com/ELEVATE-Project/survey-project-creation-service/issues

---

## License

This project is licensed under the terms specified in the LICENSE file.
