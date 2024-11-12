# Environment Variable Modification Guide

## Overview

The existing documentation and setup guides include a set of environment files with default environment variables. These serve as an excellent starting point for any deployment and offer a fully operational Mentor application for you to explore.

However, as expected, certain features may be impaired without replacing the default environment variables with adopter-specific values. For example, variables related to notification email services and cloud file upload.

This document acts as a reference for such functionalities or features and their related environment variables.

## Affected Features

1. **User Signup**

    Since an email with an OTP code is sent to verify the email ID provided during the signup process, the Notification service environment variables must be configured with real values sourced from an email service.

    Currently, the Notification service natively supports [Twilio® SendGrid](https://sendgrid.com/en-us) as the default email service. Therefore, the following environment variables must be set for this feature to function properly.

    ### Notification Service

    **Docker Setup:** `notification_env`

    **Manual Setup:** `notification/src/.env`

    **Variables:**

    ```
    SENDGRID_API_KEY
    SENDGRID_FROM_EMAIL
    ```

    > **Note:** If the **APPLICATION_ENV** in the User service is set to "**development**," the OTP code will be logged in the console. This feature might be advantageous in a local setup as it bypasses the need for a Sendgrid account. Logging is disabled in production environments (**APPLICATION_ENV=production**).

2. **File Upload**

    The application utilizes file upload functionality to implement several features like profile and session image upload, bulk user creation and bulk session creation. Therefore, it is expected that you have a bucket configured with a cloud provider of your choosing (AWS, GCP, AZURE, or OCI). And relevant environment fields are set in the following services.

    ### Mentor and User Services

    **Docker Setup:** `survey_project_creation_env`, `user_env`

    **Manual Setup:** `survey-project-creation-service/src/.env`, `user/src/.env`

    **Variables:**

    ```
    CLOUD_STORAGE_PROVIDER			->Choice of cloud provider (AWS, GCP, AZURE, OCI)
    CLOUD_STORAGE_ACCOUNTNAME
    CLOUD_STORAGE_SECRET
    CLOUD_STORAGE_REGION
    CLOUD_ENDPOINT="s3.ap-south-1.amazonaws.com"
    CLOUD_STORAGE_BUCKETNAME="private-or-public-bucket"
    PUBLIC_ASSET_BUCKETNAME="public-bucket"
    ```

3. **Support Emails**

    The application provides a mechanism for users to generate request emails that are sent to a support team overseeing user requests. For example, if a user wants to delete their account or report an issue, they can trigger an email with their request message from the portal.

    <div style="text-align: left; width: 100%;">
        <h4 style="text-align: left;">Report Issue Help Page</h4>
        <img src="../../public/images/help_report_issue.png" alt="MentorEd Report Issue Help Page" 
            style="max-width: 100%; height: auto; width: auto; max-height: 300px;">
    </div>

    For this feature to function, support email IDs and other values must be set in the Mentor service as listed below.

    ### Mentor Service

    **Docker Setup:** `mentoring_env`

    **Manual Setup:** `mentoring/src/.env`

    **Variables:**

    ```
    SUPPORT_EMAIL_ID
    ENABLE_EMAIL_FOR_REPORT_ISSUE			-> Already enabled in default/sample env files
    ```

    > **Important:** As a prerequisite, the Notification service must be configured with the proper SendGrid environment variables, as shown in the User SignUp section.

4. **Email Encryption**

    The application has enhanced its security by implementing system-wide email encryption, now enabled by default. This update ensures that email IDs are not stored as plaintext in the database. Instead, they are encrypted using the `AES-256-CBC` algorithm. The encryption and decryption processes are governed by the following environment variables:

    ### User Service

    **Docker Setup:** `user_env`

    **Manual Setup:** `user/src/.env`

    **Variables:**

    ```
    EMAIL_ID_ENCRYPTION_KEY
    EMAIL_ID_ENCRYPTION_IV
    ```

    > **Critical:** The default environment files provided with the deployment guide contain default but valid values for the email encryption variables. Replace these default values with unique ones for your deployment to avoid the risk of using a publicly available KEY and IV pair for encrypting your email IDs.

    To generate a new, valid pair of KEY and IV, you can use the following script: [Generate Encryption Keys](https://github.com/ELEVATE-Project/user/blob/master/src/scripts/generateEncyrptionKeys.js).

5. **CAPTCHA**

    Since version 2.6.1, the application has introduced the option to implement CAPTCHA using [Google reCAPTCHA](https://www.google.com/recaptcha/about/) on various portal pages such as Login and SignUp. By default, this feature is disabled in the configuration settings found in the default environment files included in the deployment guide.

    If you wish to enable CAPTCHA, you need to obtain a `site key` and `secret key` from Google. To do this, follow the instructions provided in the [reCAPTCHA Developer Guide](https://developers.google.com/recaptcha/intro). Once you have your keys, update the following environment variables to activate CAPTCHA on your site.

    ### User Service

    **Docker Setup:** `user_env`

    **Manual Setup:** `user/src/.env`

    **Variables:**

    ```
    CAPTCHA_ENABLE                  -> Set it as true
    RECAPTCHA_SECRET_KEY
    ```

    ### Portal

    **Docker Setup:** `environment.ts`

    **Manual Setup:** `src/environments/environment.ts`

    **Variables:**

    ```
    recaptchaSiteKey                -> Eg. recaptchaSiteKey:"6ASfWasd68fAAAAACxKbas98df63BwbJkJas8df67IM_6Ea"
    ```

6. **Session Management**

    Since version 2.6.1, the application includes advanced features for user session management, such as inactivity timeouts, session tracking, and remote logout. These features are controlled by the following environment variables:

    ### User Service

    **Docker Setup:** `user_env`

    **Manual Setup:** `user/src/.env`

    **Variables:**

    ```
    ALLOWED_IDLE_TIME
    ALLOWED_ACTIVE_SESSIONS
    ```

    **Explanation**:

    - **ALLOWED_IDLE_TIME**: Specifies the maximum duration (in milliseconds) a user can remain idle before their session expires. If set to 5 minutes, for example, the session will expire after 5 minutes of inactivity. The default setting is zero, which means the session duration solely depends on the user token's expiration time.

    - **ALLOWED_ACTIVE_SESSIONS**: Defines the limit on the number of concurrent sessions a user can have. By default, there is no limit, allowing an unlimited number of active sessions.

7. **Rate Limiting**

    The rate-limiting feature has been introduced in version 2.6.1 to enhance system stability and prevent abuse. This feature regulates the number of requests a user can make to the services within a given timeframe. Rate-limiting is enabled by default.

    ### User Service

    **Docker Setup:** `interface_env`

    **Manual Setup:** `interface-service/src/.env`

    **Variables:**

    ```
    RATE_LIMITER_NUMBER_OF_PROXIES
    RATE_LIMITER_ENABLED
    ```

    Refer to the [Rate-Limiting Guide](./MentorEd-Rate-Limiting-Guide.md) for more information on how to set these variables.
