FROM alpine:latest
EXPOSE 3004
WORKDIR /github-languages
COPY . .
COPY init.sh /bin
RUN rm /github-languages/init.sh
RUN chmod +x /bin/init.sh
ENTRYPOINT "init.sh"
