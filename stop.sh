#!/bin/sh

if [ -f "/home/ec2-user/auth/server/stop.sh" ]; then
  chmod +x /home/ec2-user/auth/server/stop.sh
  /home/ec2-user/auth/server/stop.sh
# else run auth-server deploy workflow
fi
