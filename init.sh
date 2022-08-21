#!/bin/sh

if [ -f "/home/ec2-user/auth/server/init.sh" ]; then
  chmod +x /home/ec2-user/auth/server/init.sh
  /home/ec2-user/auth/server/init.sh
# else run auth-server deploy workflow
fi
