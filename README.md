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

-   **Operating System:** Ubuntu 22/Windows 11/macos 12
-   **Node.js®:** v20
-   **PostgreSQL:** 16
-   **Apache Kafka®:** 3.5.0

# Setup Options

**Elevate services can be setup in local using two methods:**

<details><summary>Dockerized Services & Dependencies Using Docker-Compose File</summary>

## Dockerized Services & Dependencies

Expectation: Upon following the prescribed steps, you will achieve a fully operational MentorEd application setup, complete with both the portal and backend services.

## Prerequisites

To set up the MentorEd application, ensure you have Docker and Docker Compose installed on your system. For Ubuntu users, detailed installation instructions for both can be found in the documentation here: [How To Install and Use Docker Compose on Ubuntu](https://www.digitalocean.com/community/tutorials/how-to-install-and-use-docker-compose-on-ubuntu-20-04). For Windows and MacOS users, you can refer to the Docker documentation for installation instructions: [Docker Compose Installation Guide](https://docs.docker.com/compose/install/). Once these prerequisites are in place, you're all set to get started with setting up the MentorEd application.

## Installation

1.  **Create survey-project-creation Directory:** Create a directory named **survey-project-creation**.

    > Example Command: `mkdir survey-project-creation && cd survey-project-creation/`

2.  **Download Docker Compose File:** Retrieve the **[docker-compose.yml](https://github.com/ELEVATE-Project/survey-project-creation-service/blob/develop/src/scripts/setup/docker-compose.yml)** file from the survey-project-creation-service repository and save it to the survey-project-creation directory.

    ```
    curl -OJL https://github.com/ELEVATE-Project/survey-project-creation-service/raw/main/documentation/1.0/dockerized/docker-compose.yml
    ```

    > Note: All commands are run from the survey-project-creation directory.

    Directory structure:

    ```
    ./survey-project-creation
    └── docker-compose.yml
    ```

3.  **Download Environment Files**: Using the OS specific commands given below, download environment files for all the services.

    -   **Ubuntu/Linux/Mac**
        ```
        curl -L \
         -O https://github.com/ELEVATE-Project/survey-project-creation-service/raw/main/documentation/1.0/dockerized/envs/interface_env \
         -O https://github.com/ELEVATE-Project/survey-project-creation-service/raw/main/documentation/1.0/dockerized/envs/survey_project_creation_env \
         -O https://github.com/ELEVATE-Project/survey-project-creation-service/raw/main/documentation/1.0/dockerized/envs/notification_env \
         -O https://github.com/ELEVATE-Project/survey-project-creation-service/raw/main/documentation/1.0/dockerized/envs/scheduler_env \
         -O https://github.com/ELEVATE-Project/survey-project-creation-service/raw/main/documentation/1.0/dockerized/envs/user_env \
         -O https://github.com/ELEVATE-Project/survey-project-creation-service/raw/main/documentation/1.0/dockerized/envs/environment.ts
        ```
    -   **Windows**

        ```
        curl -L ^
            -O https://github.com/ELEVATE-Project/survey-project-creation-service/raw/master/documentation/1.0/dockerized/envs/interface_env ^
            -O https://github.com/ELEVATE-Project/survey-project-creation-service/raw/master/documentation/1.0/dockerized/envs/survey_project_creation_env ^
            -O https://github.com/ELEVATE-Project/survey-project-creation-service/raw/master/documentation/1.0/dockerized/envs/notification_env ^
            -O https://github.com/ELEVATE-Project/survey-project-creation-service/raw/master/documentation/1.0/dockerized/envs/scheduler_env ^
            -O https://github.com/ELEVATE-Project/survey-project-creation-service/raw/master/documentation/1.0/dockerized/envs/user_env ^
            -O https://github.com/ELEVATE-Project/survey-project-creation-service/raw/master/documentation/1.0/dockerized/envs/environment.ts
        ```

    > **Note:** Modify the environment files as necessary for your deployment using any text editor, ensuring that the values are appropriate for your environment. The default values provided in the current files are functional and serve as a good starting point. Refer to the sample env files provided at the [Survey Project Creation](https://github.com/ELEVATE-Project/survey-project-creation-service/blob/develop/src/.env.sample), [User](https://github.com/ELEVATE-Project/user/blob/master/src/.env.sample), [Notification](https://github.com/ELEVATE-Project/notification/blob/master/src/.env.sample), [Scheduler](https://github.com/ELEVATE-Project/scheduler/blob/master/src/.env.sample), and [Interface](https://github.com/ELEVATE-Project/interface-service/blob/main/src/.env.sample) repositories for reference.

    > **Caution:** While the default values in the downloaded environment files enable the Self Creation Portal Application to operate, certain features may not function correctly or could be impaired unless the adopter-specific environment variables are properly configured.
    >
    > For detailed instructions on adjusting these values, please consult the **[MentorEd Environment Variable Modification Guide](https://github.com/ELEVATE-Project/survey-project-creation-service/blob/develop/documentation/1.0/MentorEd-Env-Modification-README.md)**.

    > **Important:** As mentioned in the above linked document, the **User SignUp** functionality may be compromised if key environment variables are not set correctly during deployment. If you opt to skip this setup, consider using the sample user account generator detailed in the `Sample User Accounts Generation` section of this document.

4.  **Download `replace_volume_path` Script File**

    -   **Ubuntu/Linux/Mac**

        ```
        curl -OJL https://raw.githubusercontent.com/ELEVATE-Project/survey-project-creation-service/develop/documentation/1.0/dockerized/scripts/mac-linux/replace_volume_path.sh
        ```

    -   **Windows**

        ```
        curl -OJL https://raw.githubusercontent.com/ELEVATE-Project/survey-project-creation-service/develop/documentation/1.0/dockerized/scripts/windows/replace_volume_path.bat
        ```

5.  **Run `replace_volume_path` Script File**

    -   **Ubuntu/Linux/Mac**
        1. Make the `replace_volume_path.sh` file an executable.
            ```
            chmod +x replace_volume_path.sh
            ```
        2. Run the script file using the following command.
            ```
            ./replace_volume_path.sh
            ```
    -   **Windows**

        Run the script file either by double clicking it or by executing the following command from the terminal.

        ```
        replace_volume_path.bat
        ```

        > **Note**: The provided script file replaces the host path for the **portal** service container volume in the `docker-compose.yml` file with your current directory path.
        >
        > volumes:
        >
        > \- /home/priyanka/elevate/backend/environment.ts:/app/src/environments/environment.ts

6.  **Download `docker-compose-up` & `docker-compose-down` Script Files**

    -   **Ubuntu/Linux/Mac**

        1. Download the files.

            ```
            curl -OJL https://github.com/ELEVATE-Project/survey-project-creation-service/raw/develop/documentation/1.0/dockerized/scripts/mac-linux/docker-compose-up.sh
            ```

            ```
            curl -OJL https://github.com/ELEVATE-Project/survey-project-creation-service/raw/develop/documentation/1.0/dockerized/scripts/mac-linux/docker-compose-down.sh
            ```

        2. Make the files executable by running the following commands.

            ```
            chmod +x docker-compose-up.sh
            ```

            ```
            chmod +x docker-compose-down.sh
            ```

    -   **Windows**

        ```
        curl -OJL https://github.com/ELEVATE-Project/survey-project-creation-service/raw/master/documentation/1.0/dockerized/scripts/windows/docker-compose-up.bat
        ```

        ```
        curl -OJL https://github.com/ELEVATE-Project/survey-project-creation-service/raw/master/documentation/1.0/dockerized/scripts/windows/docker-compose-down.bat
        ```
