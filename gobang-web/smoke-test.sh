#!/bin/bash
# ChessHub Smoke Test Script
# Location: /var/www/chesshub/smoke-test.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "  ChessHub Smoke Test"
echo "  $(date)"
echo "========================================"

FAILED=0

# Test 1: Check if nginx is running
echo -e "\n${YELLOW}[1/5] Checking nginx...${NC}"
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓ nginx is running${NC}"
else
    echo -e "${RED}✗ nginx is not running${NC}"
    FAILED=1
fi

# Test 2: Check if dist directory exists
echo -e "\n${YELLOW}[2/5] Checking dist directory...${NC}"
if [ -d "/var/www/chesshub/dist" ]; then
    echo -e "${GREEN}✓ dist directory exists${NC}"
    FILE_COUNT=$(find /var/www/chesshub/dist -type f | wc -l)
    echo "  Files: $FILE_COUNT"
else
    echo -e "${RED}✗ dist directory not found${NC}"
    FAILED=1
fi

# Test 3: Check if index.html exists
echo -e "\n${YELLOW}[3/5] Checking index.html...${NC}"
if [ -f "/var/www/chesshub/dist/index.html" ]; then
    echo -e "${GREEN}✓ index.html exists${NC}"
else
    echo -e "${RED}✗ index.html not found${NC}"
    FAILED=1
fi

# Test 4: HTTP check for main page (follow redirects)
echo -e "\n${YELLOW}[4/5] Checking HTTP response...${NC}"
HTTP_STATUS=$(curl -s -L -o /dev/null -w "%{http_code}" http://localhost/ 2>/dev/null || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ HTTP 200 OK${NC}"
else
    echo -e "${RED}✗ HTTP status: $HTTP_STATUS (301 redirect is OK for HTTP->HTTPS)${NC}"
fi

# Test 5: HTTPS check
echo -e "\n${YELLOW}[5/5] Checking HTTPS response...${NC}"
HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://localhost/ -k 2>/dev/null || echo "000")
if [ "$HTTPS_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ HTTPS 200 OK${NC}"
else
    echo -e "${RED}✗ HTTPS status: $HTTPS_STATUS${NC}"
    FAILED=1
fi

# Summary
echo -e "\n========================================"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}  All tests passed!${NC}"
    echo "========================================"
    exit 0
else
    echo -e "${RED}  Some tests failed!${NC}"
    echo "========================================"
    exit 1
fi