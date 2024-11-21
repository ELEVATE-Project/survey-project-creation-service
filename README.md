<div align="center">

# Survey Project Creation Service

<a href="https://shikshalokam.org/elevate/">
<img
    src="https://shikshalokam.org/wp-content/uploads/2021/06/elevate-logo.png"
    height="140"
    width="300"
  />
</a>

[![CircleCI](https://dl.circleci.com/status-badge/img/gh/ELEVATE-Project/mentoring/tree/master.svg?style=shield)](https://dl.circleci.com/status-badge/redirect/gh/ELEVATE-Project/mentoring/tree/master)
[![Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://prettier.io)
[![Docs](https://img.shields.io/badge/Docs-success-informational)](https://elevate-docs.shikshalokam.org/mentorEd/intro)

![GitHub package.json version (subfolder of monorepo)](https://img.shields.io/github/package-json/v/ELEVATE-Project/mentoring?filename=src%2Fpackage.json)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)

<details><summary>CircleCI insights</summary>

[![CircleCI](https://dl.circleci.com/insights-snapshot/gh/ELEVATE-Project/mentoring/master/buil-and-test/badge.svg?window=30d)](https://app.circleci.com/pipelines/github/ELEVATE-Project/survey-project-creation-service?branch=develop)

</details>

<details><summary>develop</summary>

[![CircleCI](https://dl.circleci.com/status-badge/img/gh/ELEVATE-Project/survey-project-creation-service/tree/develop.svg?style=shield)](https://dl.circleci.com/status-badge/redirect/gh/ELEVATE-Project/mentoring/tree/develop)
![GitHub package.json version (subfolder of monorepo)](https://img.shields.io/github/package-json/v/ELEVATE-Project/mentoring/develop?filename=src%2Fpackage.json)

[![CircleCI](https://dl.circleci.com/insights-snapshot/gh/ELEVATE-Project/survey-project-creation-service/dev/buil-and-test/badge.svg?window=30d)](https://app.circleci.com/insights/github/ELEVATE-Project/survey-project-creation-service/workflows/buil-and-test/overview?branch=develop&reporting-window=last-30-days&insights-snapshot=true)

</details>

</br>
The survey project creation module enables creators to independently design and build surveys, observation programs, and related resources without needing assistance from the support team. Once created, a reviewer will assess the project, and authorized users with the necessary permissions can roll out the resource for end users to access and consume.

</div>
<!-- [![CircleCI](https://dl.circleci.com/status-badge/img/gh/ELEVATE-Project/mentoring/tree/dev.svg?style=shield)](https://dl.circleci.com/status-badge/redirect/gh/ELEVATE-Project/mentoring/tree/dev)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=ELEVATE-Project_mentoring&metric=duplicated_lines_density&branch=master)](https://sonarcloud.io/summary/new_code?id=ELEVATE-Project_mentoring)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=ELEVATE-Project_mentoring&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=ELEVATE-Project_mentoring)
<a href="https://shikshalokam.org/elevate/">
<img
    src="https://shikshalokam.org/wp-content/uploads/2021/06/elevate-logo.png"
    height="140"
    width="300"
   align="right"
  />
</a>
(Dev)
 -->

# System Requirements

-   **Operating System:**
    -   **Ubuntu** (Recommended: Version 20 and above)
    -   **Windows** (Recommended: Version 11 and above)
    -   **macOS** (Recommended: Version 12 and above)
-   **Node.js®:** v20
-   **PostgreSQL:** 16
-   **Apache Kafka®:** 3.5.0

# Setup Options

**Elevate services can be setup in local using two methods:**

> Note : This guide outlines two setup methods, detailed below. For a quick, beginner-friendly setup and walkthrough of services, it is recommended to use the Dockerized Services & Dependencies setup with the Docker-Compose file.

<details><summary>Dockerized Services & Dependencies Using Docker-Compose File</summary>

## Dockerized Services & Dependencies

Expectation: Upon following the prescribed steps, you will achieve a fully operational Self Creation Portal application setup, complete with both the portal and backend services.

## Prerequisites

To set up the Self Creation Portal application, ensure you have Docker and Docker Compose installed on your system. For Ubuntu users, detailed installation instructions for both can be found in the documentation here: [How To Install and Use Docker Compose on Ubuntu](https://www.digitalocean.com/community/tutorials/how-to-install-and-use-docker-compose-on-ubuntu-20-04). For Windows and MacOS users, you can refer to the Docker documentation for installation instructions: [Docker Compose Installation Guide](https://docs.docker.com/compose/install/). Once these prerequisites are in place, you're all set to get started with setting up the MentorEd application.

## Installation

1.  **Create survey-project-creation Directory:**
    Create a directory named **survey-project-creation**.

    > Example Command: `mkdir survey-project-creation && cd survey-project-creation/`

    > Note: All commands are run from the project directory.

## Operating Systems: Linux / macOS

> **Caution:** Before proceeding, please ensure that the ports given here are available and open. It is essential to verify their availability prior to moving forward. You can run below command in your teminal to check this

```
for port in 6001 3569 3001 3002 4000 9092 5432 7008 2181 2707 ; do
    if lsof -iTCP:$port -sTCP:LISTEN &>/dev/null; then
        echo "Port $port is in use"
    else
        echo "Port $port is available"
    fi
done
```

1.  **Download and execute main setup script:**
    Execute the following command in your terminal from the project directory.

    ```bash
    curl -OJL https://github.com/ELEVATE-Project/survey-project-creation-service/raw/readme/documentation/1.0.0/dockerized/scripts/mac-linux/setup_scp.sh && chmod +x setup_scp.sh && ./setup_scp.sh
    ```

    > Note : The script will download all the essential files and launch the services in Docker. Once all services are successfully up and running, you can proceed to the next steps.

    **General Instructions :**

        1. All containers which are part of the docker-compose can be gracefully stopped by pressing Ctrl + c in the same terminal where the services are running.

        2. All docker containers can be stopped and removed by using below command.
            ```
            ./docker-compose-down.sh
            ```
        3. All services and dependencies can be started using below command.
            ```
             ./docker-compose-up.sh
            ```

    **Keep the current terminal session active, and kindly open a new terminal window within the survey-project-creation directory.**

**After successfully completing this, please move to the next section: [Enable Citus Extension](#enable-citus-extension-optional)**

## Operating Systems: Windows

1.  **Download Docker Compose File:** Retrieve the **[docker-compose-project.yml](https://github.com/ELEVATE-Project/survey-project-creation-service/raw/readme/documentation/1.0.0/dockerized/docker-compose.yml)** file from the Project service repository and save it to the project directory.

    ```
    curl -OJL https://github.com/ELEVATE-Project/survey-project-creation-service/raw/readme/documentation/1.0.0/dockerized/docker-compose.yml
    ```

    > Note: All commands are run from the project directory.

2.  **Download Environment Files**: Using the OS specific commands given below, download environment files for all the services.

    -   **Windows**

        ```
        curl -L ^
         -O https://github.com/ELEVATE-Project/survey-project-creation-service/raw/readme/documentation/1.0.0/dockerized/envs/interface_env ^
         -O https://github.com/ELEVATE-Project/survey-project-creation-service/raw/readme/documentation/1.0.0/dockerized/envs/survey_project_creation_env ^
         -O https://github.com/ELEVATE-Project/survey-project-creation-service/raw/readme/documentation/1.0.0/dockerized/envs/entity_management_env ^
         -O https://github.com/ELEVATE-Project/survey-project-creation-service/raw/readme/documentation/1.0.0/dockerized/envs/project_env ^
         -O https://github.com/ELEVATE-Project/survey-project-creation-service/raw/readme/documentation/1.0.0/dockerized/envs/notification_env ^
         -O https://github.com/ELEVATE-Project/survey-project-creation-service/raw/readme/documentation/1.0.0/dockerized/envs/scheduler_env ^
         -O https://github.com/ELEVATE-Project/survey-project-creation-service/raw/readme/documentation/1.0.0/dockerized/envs/user_env ^
         -O https://github.com/ELEVATE-Project/survey-project-creation-service/raw/readme/documentation/1.0.0/dockerized/envs/environment.ts
        ```

    > **Note:** Modify the environment files as necessary for your deployment using any text editor, ensuring that the values are appropriate for your environment. The default values provided in the current files are functional and serve as a good starting point. Refer to the sample env files provided at the [Survey Project Creation](https://github.com/survey-project-creation-service/project-service/blob/readme/.env.sample), [User](https://github.com/survey-project-creation-service/user/blob/master/src/.env.sample), [Notification](https://github.com/survey-project-creation-service/notification/blob/master/src/.env.sample), [Scheduler](https://github.com/survey-project-creation-service/scheduler/blob/master/src/.env.sample), [Interface](https://github.com/survey-project-creation-service/interface-service/blob/readme/src/.env.sample) and [Entity-management](https://github.com/survey-project-creation-service/entity-management/blob/readme/src/.env.sample) repositories for reference.

    > **Caution:** While the default values in the downloaded environment files enable the Project Application to operate, certain features may not function correctly or could be impaired unless the adopter-specific environment variables are properly configured.

3.  **Download `replace_volume_path` Script File**

    -   **Windows**

        ```
        curl -OJL https://raw.githubusercontent.com/survey-project-creation-service/project-service/readme/documentation/1.0.0/dockerized/scripts/windows/replace_volume_path.bat
        ```

4.  **Run `replace_volume_path` Script File**

    -   **Windows**

        Run the script file either by double clicking it or by executing the following command from the terminal.

        ```
        replace_volume_path.bat
        ```

        > **Note**: The provided script file replaces the host path for the **portal** service container volume in the `docker-compose.yml` file with your current directory path.
        >
        > volumes:
        >
        > \- /home/priyanka/survey-project-creation/environment.ts:/app/src/environments/environment.ts

5.  **Download `docker-compose-up` & `docker-compose-down` Script Files**

    -   **Windows**

        ```
        curl -OJL https://github.com/ELEVATE-Project/project-service/raw/readme/documentation/1.0.0/dockerized/scripts/windows/docker-compose-up.bat
        ```

        ```
        curl -OJL https://github.com/ELEVATE-Project/project-service/raw/readme/documentation/1.0.0/dockerized/scripts/windows/docker-compose-down.bat
        ```

6.  **Run All Services & Dependencies**:All services and dependencies can be started using the `docker-compose-up` script file.

    -   **Windows**

        ```
        docker-compose-up.bat
        ```

        > Double-click the file or run the above command from the terminal.

        > **Note**: During the first Docker Compose run, the database, migration seeder files, and the script to set the default organization will be executed automatically.

7.  **Remove All Service & Dependency Containers**:
    All docker containers can be stopped and removed by using the `docker-compose-down` file.

    -   **Windows**

        ```
        docker-compose-down.bat
        ```

    > **Caution**: As per the default configuration in the `docker-compose-project.yml` file, using the `down` command will lead to data loss since the database container does not persist data. To persist data across `down` commands and subsequent container removals, refer to the "Persistence of Database Data in Docker Containers" section of this documentation.

## Enable Citus Extension

Self Creation Portal relies on PostgreSQL as its core database system. To boost performance and scalability, users can opt to enable the Citus extension. This transforms PostgreSQL into a distributed database, spreading data across multiple nodes to handle large datasets more efficiently as demand grows.

For more information, refer **[Citus Data](https://www.citusdata.com/)**.

To enable the Citus extension for survey-project-creation and user services, follow these steps.

1. Create a sub-directory named `survey-project-creation` and download `distributionColumns.sql` into it.

```
mkdir survey-project-creation && curl -o ./survey-project-creation/distributionColumns.sql -JL https://github.com/ELEVATE-Project/survey-project-creation-service/raw/develop/documentation/1.0.0/distribution-columns/survey-project-creation-service/distributionColumns.sql
```

2. Create a sub-directory named `user` and download `distributionColumns.sql` into it.

```
mkdir user && curl -o ./user/distributionColumns.sql -JL https://github.com/ELEVATE-Project/survey-project-creation-service/raw/develop/documentation/1.0.0/distribution-columns/user/distributionColumns.sql
```

3. Set up the citus_setup file by following the steps given below.

-   **Ubuntu/Linux/Mac**

    1. Download the `citus_setup.sh` file.

        ```
        curl -OJL https://github.com/ELEVATE-Project/survey-project-creation-service/raw/develop/documentation/1.0.0/dockerized/scripts/mac-linux/citus_setup.sh
        ```

    2. Enable Citus and set distribution columns for `survey-project-creation-service` database by running the `citus_setup.sh`with the following arguments.
        ```
        ./citus_setup.sh survey-project-creation-service postgres://postgres:postgres@citus_master:5432/elevate-scp
        ```
    3. Enable Citus and set distribution columns for `user` database by running the `citus_setup.sh`with the following arguments.
        ```
        ./citus_setup.sh user postgres://postgres:postgres@citus_master:5432/user
        ```

-   **Windows**
    1. Download the `citus_setup.bat` file.
        ```
        curl -OJL https://github.com/ELEVATE-Project/survey-project-creation-service/raw/develop/documentation/1.0/dockerized/scripts/windows/citus_setup.bat
        ```
    2. Enable Citus and set distribution columns for `survey-project-creation-service` database by running the `citus_setup.bat`with the following arguments.
        ```
        citus_setup.bat survey-project-creation-service postgres://postgres:postgres@citus_master:5432/elevate-scp
        ```
    3. Enable Citus and set distribution columns for `user` database by running the `citus_setup.bat`with the following arguments.
        ```
        citus_setup.bat user postgres://postgres:postgres@citus_master:5432/user
        ```
        > **Note:** Since the `citus_setup.bat` file requires arguments, it must be run from a terminal.

## Persistence Of Database Data In Docker Container

To ensure the persistence of database data when running `docker compose down`, it is necessary to modify the `docker-compose.yml` file according to the steps given below:

1. **Modification Of The `docker-compose.yml` File:**

    Begin by opening the `docker-compose.yml` file. Locate the section pertaining to the Citus container and proceed to uncomment the volume specification. This action is demonstrated in the snippet provided below:

    ```yaml
    citus:
        image: citusdata/citus:11.2.0
        container_name: 'citus_master'
        ports:
            - 5432:5432
        volumes:
            - citus-data:/var/lib/postgresql/data
    ```

2. **Uncommenting Volume Names Under The Volumes Section:**

    Next, navigate to the volumes section of the file and proceed to uncomment the volume names as illustrated in the subsequent snippet:

    ```yaml
    networks:
        elevate_net:
            external: false

    volumes:
        citus-data:
    ```

By implementing these adjustments, the configuration ensures that when the `docker-compose down` command is executed, the database data is securely stored within the specified volumes. Consequently, this data will be retained and remain accessible, even after the containers are terminated and subsequently reinstated using the `docker-compose up` command.

## Sample User Accounts Generation

During the initial setup of Self Creation portal services with the default configuration, you may encounter issues creating new accounts through the regular SignUp flow on the Self Creation portal. This typically occurs because the default SignUp process includes OTP verification to prevent abuse. Until the notification service is configured correctly to send actual emails, you will not be able to create new accounts.

In such cases, you can generate sample user accounts using the steps below. This allows you to explore the survey-project creation services and portal immediately after setup.

> **Warning:** Use this generator only immediately after the initial system setup and before any normal user accounts are created through the portal. It should not be used under any circumstances thereafter.

**Ubuntu/Linux/Mac**

    ```
    ./insert_sample_data.sh user postgres://postgres:postgres@citus_master:5432/user
    ```

-   **Windows**

    1. **Download The `sampleData.sql` Files:**

        ```
        mkdir sample-data\user 2>nul & ^
        curl -L "https://raw.githubusercontent.com/ELEVATE-Project/project-service/readme/documentation/1.0.0/sample-data/windows/user/sampleData.sql" -o sample-data\user\sampleData.sql
        ```

    2. **Download The `insert_sample_data` Script File:**

        ```
        curl -L -o insert_sample_data.bat https://raw.githubusercontent.com/ELEVATE-Project/project-service/refs/heads/readme/documentation/1.0.0/dockerized/scripts/windows/insert_sample_data.bat
        ```

    3. **Run The `insert_sample_data` Script File:**

        ```
        insert_sample_data.bat user postgres://postgres:postgres@citus_master:5432/user
        ```

    After successfully running the script mentioned above, the following user accounts will be created and available for login:

    | Email ID                 | Password   | Role            |
    | ------------------------ | ---------- | --------------- |
    | priyanka@tunerlabs.com   | Password1@ | reviewer        |
    | adithya@shikshalokam.com | Password1@ | content_creator |

## Explore the Portal

Once the services are up and the front-end app bundle is built successfully, navigate to **[localhost:7007](http://localhost:7007/)** to access the Self Creation Portal app.

> **Warning:** In this setup, features such as **Sign-Up, Project Creation, Review Flow and Rollout** will not be available because cloud storage credentials have been masked in the environment files for security reasons.

</details>
