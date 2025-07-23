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
    ```bash
      node migrateProgramsAndSolutions.js
    ```

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
