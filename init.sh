#!/bin/bash

yum update -y && yum upgrade -y
cd /home/ec2-user/auth-server
npm ci
screen -Sdm node npm run start
