#!/bin/bash

# Run commands as the apple user, explicitly using the postgres database
psql -U apple -p 5432 -d postgres -c "CREATE USER postgres WITH ENCRYPTED PASSWORD 'postgres';"

# Create the user database and assign privileges
psql -U apple -p 5432 -d postgres -c "CREATE DATABASE users;"
psql -U apple -p 5432 -d users -c "GRANT ALL PRIVILEGES ON DATABASE users TO postgres;"
psql -U apple -p 5432 -d users -c "GRANT ALL ON SCHEMA public TO postgres;"

# Create the notification database and assign privileges
psql -U apple -p 5432 -d postgres -c "CREATE DATABASE notification;"
psql -U apple -p 5432 -d notification -c "GRANT ALL PRIVILEGES ON DATABASE notification TO postgres;"
psql -U apple -p 5432 -d notification -c "GRANT ALL ON SCHEMA public TO postgres;"

# Create the Self Creation Portal database and assign privileges
psql -U apple -p 5432 -d postgres -c "CREATE DATABASE self_creation_portal;"
psql -U apple -p 5432 -d notification -c "GRANT ALL PRIVILEGES ON DATABASE self_creation_portal TO postgres;"
psql -U apple -p 5432 -d notification -c "GRANT ALL ON SCHEMA public TO postgres;"

echo "Database setup complete."