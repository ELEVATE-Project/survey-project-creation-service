# 🛠️ Script Execution Guide

This repository contains a collection of Node.js scripts used for initial setup and data migration for the Elevate and Sunbird projects.

---

### 📤 Upload Default Certificate Template

This script uploads the default certificate base template to cloud storage. It should only be run **once** during the initial project setup.

### 🔧 Steps to Run:

1. Navigate to the scripts directory:

    ```bash
     cd src/scripts
    ```

2. Run the upload script:
    ```bash
     node -r module-alias/register uploadCertificateBaseTemplate.js
    ```

### 🧱 Add Default Entities for Education Sector

This script creates default entities relevant to the education domain.
⚠️ Note: The script includes education-related entities by default. You can modify the script file to include additional or custom entities.

### 🔧 Steps to Run:

1. Navigate to the scripts directory:

    ```bash
     cd src/scripts
    ```

2. Execute the entity creation script:
    ```bash
          node addDefaultEntitiesForEducationSector.js
    ```
3. Set up new tenant dependencies in SCP
    ```bash
    node setupTenant.js --tenant_code=shikshagraha --organization_code=blr
    ```

### 🔄 Migration Scripts

#### 📁 Elevate Project Migration

1. 📌 Navigate to the Elevate migration directory:

    ```bash
      cd src/scripts/sunbirdProject
    ```

2. 🚀 Migrate Project Template
    ```bash
      node migrateProjects.js
    ```
3. 🚀 Migrate Programs and Solutions

    This migration can be executed in two ways:

    **Option 1: Migrate all programs and solutions (default behavior)**

    ```bash
    node migrateProgramsAndSolutions.js
    ```

    **Option 2: Migrate specific tenant and organization**

    ```bash
    node migrateProgramsAndSolutions.js --tenant_code=shikshagraha --organization_code=blr
    ```

    📝 **Note:** When using command-line arguments, both `tenant_code` and `organization_code` must be provided together. The script will only process programs belonging to the specified tenant and organization.

#### 📁 Sunbird Migration

📌 Navigate to the Sunbird migration directory:

1. 📌 Navigate to the Sunbird migration directory:

    ```bash
      cd src/scripts/sunbirdProject
    ```

2. 🚀 Migrate Project Template
    ```bash
      node migrateProjects.js
    ```
3. 🚀 Migrate Programs and Solutions
    ```bash
      node migrateProgramsAndSolutions.js
    ```
