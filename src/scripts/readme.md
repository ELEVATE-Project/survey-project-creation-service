# Script Excution

### Upload Default Certificate Template to Cloud

This script uploads the default certificate template to the cloud. It should be run only once during the initial project setup.

-   Navigate to the scripts folder using the following command
    ```bash
    cd src/scripts
    ```
-   Run **uploadCertificateBaseTemplate.js** only once while setup the project
    ```bash
        node -r module-alias/register uploadCertificateBaseTemplate.js
    ```

### Migration Script for copy all elevate project templates to SCP

This script migrates all existing project templates of elevate project

-   Navigate to the scripts folder using the following command
    ```bash
        cd src/scripts/elevateProject
    ```
-   Run the script
    ```bash
        node migrateProjects.js
    ```

### Script to Add Default Entities for the Education Sector.

This script creates default entities.
NOTE : Education related entities are added in the default script. Update the file accordingly to add desired entities.

-   Navigate to the scripts folder using the following command
    ```bash
        cd src/scripts
    ```
-   Run the script
    ```bash
          node -r module-alias/register addDefaultEntitiesForEducationSector.js
    ```
