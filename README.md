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

Expectation: Upon following the prescribed steps, you will achieve a fully operational Self Creation Portal application setup, complete with both the portal and backend services.
