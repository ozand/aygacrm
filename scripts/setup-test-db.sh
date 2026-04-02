#!/bin/bash

set -e

# Define test database path
TEST_DB_PATH="app/test.sqlite3"

echo "Setting up test database..."

# Remove existing test database if it exists
if [ -f "$TEST_DB_PATH" ]; then
  echo "Removing existing test database: $TEST_DB_PATH"
  rm "$TEST_DB_PATH"
fi

# Set DATABASE_URL for Prisma to use the test database
# This should point to the correct schema file location
DATABASE_URL="file:$TEST_DB_PATH" npx prisma db push --schema=app/prisma/schema.prisma --force

echo "Test database setup complete at $TEST_DB_PATH."
echo "You can optionally add test data seeding here."
