#!/bin/sh

if [ -f "/home/ec2-user/server/stop.sh" ]; then
  chmod +x /home/ec2-user/server/stop.sh
  /home/ec2-user/server/stop.sh
fi
