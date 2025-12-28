#!/bin/bash

# Test script to verify file permission fixes
echo "Testing SoneT file permission fixes..."

# Create a test directory
TEST_DIR="/tmp/sonet_test"
mkdir -p "$TEST_DIR"

# Create a read-only file
echo "Test content" > "$TEST_DIR/readonly_file.txt"
chmod 444 "$TEST_DIR/readonly_file.txt"

# Create a directory with no write permissions
mkdir -p "$TEST_DIR/no_write_dir"
chmod 555 "$TEST_DIR/no_write_dir"

echo "Test environment created:"
echo "- Test directory: $TEST_DIR"
echo "- Read-only file: $TEST_DIR/readonly_file.txt"
echo "- No-write directory: $TEST_DIR/no_write_dir"
echo ""
echo "You can now test SoneT with these files to verify permission handling."
echo "Try opening the read-only file and attempting to save changes."
echo "Try creating a new file in the no-write directory."
echo ""
echo "To clean up after testing, run: rm -rf $TEST_DIR"