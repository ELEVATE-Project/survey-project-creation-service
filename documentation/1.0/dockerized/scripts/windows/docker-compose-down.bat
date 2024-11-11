@echo off

rem Set environment variables
set "users_env=%cd%\user_env"
set "interface_env=%cd%\interface_env"
set "scheduler_env=%cd%\scheduler_env"
set "notification_env=%cd%\notification_env"
set "survey_project_creation_env=%cd%\survey_project_creation_env"

rem Run docker-compose
docker-compose -f docker-compose-mentoring.yml down

rem Optionally, clear environment variables after use
set "users_env="
set "interface_env="
set "scheduler_env="
set "notification_env="
set "survey_project_creation_env="

pause