FROM alpine:latest
EXPOSE 3004
WORKDIR /profile-languages
COPY . .
COPY init.sh /bin
RUN rm /profile-languages/init.sh
RUN chmod +x /bin/init.sh
ENTRYPOINT "init.sh"
